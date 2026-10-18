import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const OTP_LENGTH = 6;
const VERIFIED_TOKEN_EXPIRES_SECONDS = 10 * 60;

export const hasOtpConfig = Boolean(
  config.gmailUser
  && config.gmailAppPassword
  && config.jwtSecret,
  // Verification state must survive serverless instance changes.
);

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, expiresInSeconds = 15 * 60) {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is missing');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyOtpToken(token) {
  try {
    if (!token || !config.jwtSecret) return null;

    if (typeof token !== 'string' || token.split('.').length !== 3) return null;
    const [encodedHeader, encodedBody, signature] = token.split('.');
    if (!encodedHeader || !encodedBody || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${encodedHeader}.${encodedBody}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length) return null;

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer);
    if (!isValid) return null;

    const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.purpose !== 'email_otp' || !payload.jti || !isEmail(payload.email)) return null;

    return payload;
  } catch {
    return null;
  }
}

async function otpRpc(name, args) {
  if (!hasSupabaseConfig) throw new Error('OTP storage is not configured.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error('OTP storage is unavailable.');
  return data;
}

export async function consumeOtpToken(token, expectedEmail) {
  const payload = verifyOtpToken(token);
  const email = normalizeEmail(expectedEmail);
  if (!payload || !payload.jti || payload.email !== email) return null;
  const consumed = await otpRpc('consume_email_otp', { p_email: email, p_verification_id: payload.jti });
  return consumed === true ? payload : null;
}

function normalizeEmail(email = '') {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashOtp(email, otp) {
  return crypto
    .createHash('sha256')
    .update(`${email}:${otp}:${config.jwtSecret}`)
    .digest('hex');
}

function createOtp() {
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword.replace(/\s/g, ''),
    },
  });
}

export async function sendEmailOtp(rawEmail) {
  if (!hasOtpConfig || !hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Dịch vụ xác thực email chưa sẵn sàng.' } };
  }

  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) {
    return { ok: false, status: 400, data: { message: 'Email không hợp lệ.' } };
  }

  const otp = createOtp();
  const otpHash = hashOtp(email, otp);
  const lifetime = Math.max(1, Math.min(Number(config.otpExpiresMinutes) || 5, 10));
  const created = await otpRpc('request_email_otp', {
    p_email: email, p_hash: otpHash,
    p_expires_at: new Date(Date.now() + lifetime * 60 * 1000).toISOString(),
  });
  if (created === 'cooldown') {
    return {
      ok: false,
      status: 429,
      data: { message: 'Vui lòng chờ 60 giây trước khi gửi lại OTP.' },
    };
  }

  if (created !== 'created') throw new Error('OTP could not be created.');
  try {
    await createTransporter().sendMail({
    from: `"MidHealth" <${config.gmailUser}>`,
    to: email,
    subject: 'Mã OTP xác thực MidHealth',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Mã OTP của bạn</h2>
        <p>Dùng mã bên dưới để xác thực tài khoản MidHealth:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1976df">${otp}</p>
        <p>Mã có hiệu lực trong ${lifetime} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      </div>
    `,
    });
  } catch {
    await otpRpc('release_failed_email_otp', { p_email: email, p_hash: otpHash }).catch(() => {});
    return { ok: false, status: 503, data: { message: 'Không thể gửi email. Vui lòng thử lại.' } };
  }

  return {
    ok: true,
    status: 200,
    data: {
      message: 'Đã gửi mã OTP đến email.',
      expiresInMinutes: lifetime,
    },
  };
}

export async function verifyEmailOtp(rawEmail, otp = '') {
  const email = normalizeEmail(rawEmail);

  if (!isEmail(email) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return { ok: false, status: 400, data: { message: 'Email hoặc OTP không hợp lệ.' } };
  }

  const jti = crypto.randomUUID();
  const result = await otpRpc('verify_email_otp', {
    p_email: email, p_hash: hashOtp(email, otp), p_verification_id: jti,
  });
  if (result !== 'verified') {
    return {
      ok: false, status: result === 'locked' ? 429 : 400,
      data: { message: result === 'locked' ? 'Bạn đã nhập sai OTP quá nhiều lần. Vui lòng yêu cầu mã mới.' : 'OTP không đúng hoặc đã hết hạn.' },
    };
  }
  const token = signJwt({ purpose: 'email_otp', email, jti }, VERIFIED_TOKEN_EXPIRES_SECONDS);

  return {
    ok: true,
    status: 200,
    data: {
      message: 'Xác thực OTP thành công.',
      token,
      tokenType: 'Bearer',
      expiresInSeconds: VERIFIED_TOKEN_EXPIRES_SECONDS,
    },
  };
}
