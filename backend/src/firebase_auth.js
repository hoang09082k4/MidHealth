import crypto from 'node:crypto';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const DEFAULT_FIREBASE_PROJECT_ID = 'midhealth-1c1b9';
let firebaseCertsCache = { certs: null, expiresAt: 0 };

export const hasFirebaseConfig = Boolean(config.firebaseApiKey);

async function firebaseRequest(path, payload) {
  if (!hasFirebaseConfig) {
    return {
      ok: false,
      status: 500,
      data: { message: 'Backend chưa cấu hình FIREBASE_API_KEY.' },
    };
  }

  let response;
  let data;
  try {
    response = await fetch(`${FIREBASE_AUTH_BASE_URL}/${path}?key=${config.firebaseApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await response.json();
  } catch {
    return {
      ok: false,
      status: 503,
      data: { message: 'Không thể kết nối Firebase Authentication. Vui lòng thử lại sau.' },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: { message: mapFirebaseError(data.error?.message), code: data.error?.message },
    };
  }

  return { ok: true, status: response.status, data };
}

function mapFirebaseError(code = '') {
  if (code.includes('MISSING_PASSWORD')) return 'Vui lòng nhập mật khẩu.';
  if (code.includes('USER_NOT_FOUND')) return 'Không tìm thấy tài khoản Firebase.';
  if (code.includes('TOKEN_EXPIRED')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (code.includes('OPERATION_NOT_ALLOWED')) return 'Firebase chưa bật phương thức đăng nhập Email/Password.';
  if (code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.';
  if (code.includes('EMAIL_EXISTS')) return 'Email này đã được đăng ký.';
  if (code.includes('EMAIL_NOT_FOUND')) return 'Email chưa được đăng ký.';
  if (code.includes('INVALID_PASSWORD')) return 'Mật khẩu không đúng.';
  if (code.includes('INVALID_EMAIL')) return 'Email không hợp lệ.';
  if (code.includes('WEAK_PASSWORD')) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  if (code.includes('USER_DISABLED')) return 'Tài khoản đã bị vô hiệu hóa.';
  if (code.includes('INVALID_ID_TOKEN')) return 'Phiên đăng nhập không hợp lệ.';
  return `Không thể xử lý yêu cầu xác thực (${code || 'UNKNOWN'}).`;
}

export async function registerWithEmail({ email, password, fullName }) {
  const result = await firebaseRequest('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  if (!result.ok || !fullName) return result;

  const updateResult = await firebaseRequest('accounts:update', {
    idToken: result.data.idToken,
    displayName: fullName,
    returnSecureToken: true,
  });

  if (!updateResult.ok) return result;

  return {
    ...result,
    data: {
      ...result.data,
      displayName: fullName,
      idToken: updateResult.data.idToken || result.data.idToken,
      refreshToken: updateResult.data.refreshToken || result.data.refreshToken,
    },
  };
}

export function loginWithEmail({ email, password }) {
  return firebaseRequest('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
}

export function sendPasswordResetEmail(email) {
  return firebaseRequest('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email,
  });
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export async function resolvePatientEmailByPhone(phone) {
  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình Supabase để đăng nhập bằng số điện thoại.' },
    };
  }

  const normalizedPhone = normalizePhone(phone);
  if (!/^0(3|5|7|8|9)\d{8}$/.test(normalizedPhone)) {
    return {
      ok: false,
      status: 400,
      data: { message: 'Xin vui lòng nhập đúng số điện thoại!' },
    };
  }

  const { data, error } = await supabase
    .from('patient_profiles')
    .select('email, status')
    .eq('phone', normalizedPhone)
    .eq('role', 'patient')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  if (!data?.email) {
    return {
      ok: false,
      status: 404,
      data: { message: 'Số điện thoại này chưa được đăng ký tài khoản MidHealth.' },
    };
  }

  if (data.status && data.status !== 'active') {
    return {
      ok: false,
      status: 403,
      data: { message: 'Tài khoản liên kết với số điện thoại này chưa hoạt động.' },
    };
  }

  return { ok: true, status: 200, data: { email: data.email } };
}

export function lookupAccount(idToken) {
  return firebaseRequest('accounts:lookup', { idToken });
}

export async function verifyIdToken(idToken) {
  if (!idToken) return null;

  const result = await lookupAccount(idToken);
  if (!result.ok) return verifyIdTokenWithPublicCerts(idToken);
  return result.data.users?.[0] || null;
}

function decodeBase64Url(value = '') {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function parseJwtPart(value = '') {
  return JSON.parse(decodeBase64Url(value).toString('utf8'));
}

function parseCacheMaxAge(cacheControl = '') {
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
}

async function getFirebaseCerts() {
  if (firebaseCertsCache.certs && Date.now() < firebaseCertsCache.expiresAt) return firebaseCertsCache.certs;

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error('Unable to fetch Firebase public certificates.');

  const certs = await response.json();
  firebaseCertsCache = {
    certs,
    expiresAt: Date.now() + parseCacheMaxAge(response.headers.get('cache-control') || ''),
  };
  return certs;
}

async function verifyIdTokenWithPublicCerts(idToken) {
  try {
    const parts = String(idToken).split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = parseJwtPart(encodedHeader);
    const payload = parseJwtPart(encodedPayload);
    const projectId = config.firebaseProjectId || DEFAULT_FIREBASE_PROJECT_ID;

    if (header.alg !== 'RS256' || !header.kid) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (payload.exp * 1000 <= Date.now()) return null;

    const certs = await getFirebaseCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const signature = decodeBase64Url(encodedSignature);
    if (!verifier.verify(cert, signature)) return null;

    return {
      localId: payload.sub,
      uid: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email,
      emailVerified: Boolean(payload.email_verified),
      providerUserInfo: payload.firebase?.sign_in_provider ? [{ providerId: payload.firebase.sign_in_provider }] : [],
    };
  } catch {
    return null;
  }
}
