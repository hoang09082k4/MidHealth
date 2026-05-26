import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';

const otpStore = new Map();
const verifiedOtpTokens = new Map();
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFIED_TOKEN_EXPIRES_SECONDS = 10 * 60;

export const hasOtpConfig = Boolean(
  config.gmailUser
  && config.gmailAppPassword
  && config.jwtSecret,
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
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.purpose !== 'email_otp') return null;

    return payload;
  } catch {
    return null;
  }
}

export function consumeOtpToken(token, expectedEmail) {
  const payload = getUsableOtpToken(token, expectedEmail);
  if (!payload) return null;

  verifiedOtpTokens.delete(payload.jti);
  return payload;
}

export function getUsableOtpToken(token, expectedEmail) {
  const payload = verifyOtpToken(token);
  const email = normalizeEmail(expectedEmail);

  if (!payload || !payload.jti || payload.email !== email) return null;

  const storedToken = verifiedOtpTokens.get(payload.jti);
  if (!storedToken || storedToken.email !== email || storedToken.expiresAt < Date.now()) {
    verifiedOtpTokens.delete(payload.jti);
    return null;
  }

  return payload;
}

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword.replace(/\s/g, ''),
    },
  });
}

export async function sendEmailOtp(rawEmail) {
  if (!hasOtpConfig) {
    return { ok: false, status: 500, data: { message: 'Backend chưa cấu hình gửi OTP.' } };
  }

  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) {
    return { ok: false, status: 400, data: { message: 'Email không hợp lệ.' } };
  }

  const currentOtp = otpStore.get(email);
  if (currentOtp && Date.now() - currentOtp.lastSentAt < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      status: 429,
      data: { message: 'Vui lòng chờ 60 giây trước khi gửi lại OTP.' },
    };
  }

  const otp = createOtp();
  const expiresAt = Date.now() + config.otpExpiresMinutes * 60 * 1000;
  otpStore.set(email, {
    hash: hashOtp(email, otp),
    expiresAt,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  await createTransporter().sendMail({
    from: `"MidHealth" <${config.gmailUser}>`,
    to: email,
    subject: 'Mã OTP xác thực MidHealth',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Mã OTP của bạn</h2>
        <p>Dùng mã bên dưới để xác thực tài khoản MidHealth:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1976df">${otp}</p>
        <p>Mã có hiệu lực trong ${config.otpExpiresMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      </div>
    `,
  });

  return {
    ok: true,
    status: 200,
    data: {
      message: 'Đã gửi mã OTP đến email.',
      expiresInMinutes: config.otpExpiresMinutes,
    },
  };
}

export function verifyEmailOtp(rawEmail, otp = '') {
  const email = normalizeEmail(rawEmail);
  const storedOtp = otpStore.get(email);

  if (!isEmail(email) || !/^\d{6}$/.test(otp)) {
    return { ok: false, status: 400, data: { message: 'Email hoặc OTP không hợp lệ.' } };
  }

  if (!storedOtp) {
    return { ok: false, status: 400, data: { message: 'OTP không tồn tại hoặc đã hết hạn.' } };
  }

  if (storedOtp.expiresAt < Date.now()) {
    otpStore.delete(email);
    return { ok: false, status: 400, data: { message: 'OTP đã hết hạn.' } };
  }

  if (storedOtp.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return { ok: false, status: 429, data: { message: 'Bạn đã nhập sai OTP quá nhiều lần.' } };
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(storedOtp.hash),
    Buffer.from(hashOtp(email, otp)),
  );

  if (!isValid) {
    otpStore.set(email, { ...storedOtp, attempts: storedOtp.attempts + 1 });
    return { ok: false, status: 400, data: { message: 'OTP không đúng.' } };
  }

  otpStore.delete(email);
  const jti = crypto.randomUUID();
  verifiedOtpTokens.set(jti, {
    email,
    expiresAt: Date.now() + VERIFIED_TOKEN_EXPIRES_SECONDS * 1000,
  });
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
