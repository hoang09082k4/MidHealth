import { config } from './config.js';

const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';

export const hasFirebaseConfig = Boolean(config.firebaseApiKey);

async function firebaseRequest(path, payload) {
  if (!hasFirebaseConfig) {
    return {
      ok: false,
      status: 500,
      data: { message: 'Backend chưa cấu hình FIREBASE_API_KEY' },
    };
  }

  const response = await fetch(`${FIREBASE_AUTH_BASE_URL}/${path}?key=${config.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

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
  if (code.includes('EMAIL_EXISTS')) return 'Email này đã được đăng ký.';
  if (code.includes('EMAIL_NOT_FOUND')) return 'Email chưa được đăng ký.';
  if (code.includes('INVALID_PASSWORD')) return 'Mật khẩu không đúng.';
  if (code.includes('INVALID_EMAIL')) return 'Email không hợp lệ.';
  if (code.includes('WEAK_PASSWORD')) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  if (code.includes('USER_DISABLED')) return 'Tài khoản đã bị vô hiệu hóa.';
  if (code.includes('INVALID_ID_TOKEN')) return 'Phiên đăng nhập không hợp lệ.';
  return 'Không thể xử lý yêu cầu xác thực.';
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

export function lookupAccount(idToken) {
  return firebaseRequest('accounts:lookup', { idToken });
}
