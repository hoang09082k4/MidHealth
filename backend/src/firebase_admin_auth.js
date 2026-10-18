import crypto from 'node:crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';

const ADMIN_APP_NAME = 'midhealth-password-admin';
let cachedAuth = null;

function hasUsablePrivateKey(privateKey) {
  if (typeof privateKey !== 'string' || !privateKey.trim()) return false;
  try {
    return crypto.createPrivateKey(privateKey).asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}

function hasApplicationDefaultCredentials() {
  // If an explicit credentials file was supplied but could not be parsed,
  // do not claim ADC is available just because the file exists.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return false;
  return Boolean(
    process.env.K_SERVICE
    || process.env.GAE_ENV
    || process.env.KUBERNETES_SERVICE_HOST
    || process.env.GCE_METADATA_HOST,
  );
}

function serviceAccountProjectMatches() {
  const serviceAccountProject = config.firebaseAdminCredentials?.projectId;
  return !serviceAccountProject || !config.firebaseProjectId
    || serviceAccountProject === config.firebaseProjectId;
}

export function isFirebaseAdminConfigured() {
  const credentials = config.firebaseAdminCredentials;
  if (credentials) {
    return Boolean(
      credentials.clientEmail
      && hasUsablePrivateKey(credentials.privateKey)
      && serviceAccountProjectMatches(),
    );
  }
  return hasApplicationDefaultCredentials();
}

function getAdminAuth() {
  if (cachedAuth) return cachedAuth;

  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);
  const appOptions = { projectId: config.firebaseProjectId || undefined };
  const credentials = config.firebaseAdminCredentials;
  if (credentials?.clientEmail && credentials.privateKey) {
    if (!serviceAccountProjectMatches()) {
      const error = new Error('Firebase service account belongs to a different project.');
      error.code = 'FIREBASE_ADMIN_PROJECT_MISMATCH';
      throw error;
    }
    appOptions.credential = cert({
      projectId: credentials.projectId || config.firebaseProjectId,
      clientEmail: credentials.clientEmail,
      privateKey: credentials.privateKey,
    });
  } else {
    appOptions.credential = applicationDefault();
  }

  const app = existingApp || initializeApp(appOptions, ADMIN_APP_NAME);
  cachedAuth = getAuth(app);
  return cachedAuth;
}

function mapFirebaseAdminError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code === 'auth/user-not-found') {
    return { status: 404, message: 'Không tìm thấy tài khoản Firebase liên kết với người dùng này.' };
  }
  if (code === 'auth/invalid-uid') {
    return { status: 400, message: 'Firebase UID của tài khoản không hợp lệ.' };
  }
  if (code === 'auth/user-disabled') {
    return { status: 409, message: 'Tài khoản Firebase đang bị vô hiệu hóa. Hãy xác minh và mở khóa trước khi đặt lại mật khẩu.' };
  }
  if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
    return { status: 400, message: 'Mật khẩu bị Firebase từ chối. Hãy chọn mật khẩu khác có ít nhất 8 ký tự.' };
  }
  if (code.includes('permission') || code === 'auth/insufficient-permission') {
    return {
      status: 503,
      message: 'Service account thiếu quyền firebaseauth.users.update. Hãy cấp vai trò Firebase Authentication Admin cho service account.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return { status: 429, message: 'Firebase đang giới hạn yêu cầu. Hãy chờ một lúc rồi thử lại.' };
  }
  if (code === 'app/invalid-credential' || code === 'app/invalid-app-credential') {
    return { status: 503, message: 'Firebase Admin credential không hợp lệ. Kiểm tra service account hoặc GOOGLE_APPLICATION_CREDENTIALS.' };
  }
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError'
    || error?.code === 'ETIMEDOUT' || error?.code === 'ESOCKETTIMEDOUT') {
    return { status: 504, message: 'Kết nối Firebase quá thời gian chờ. Hãy kiểm tra mạng backend rồi thử lại.' };
  }
  if (code === 'app/invalid-project-id' || code === 'FIREBASE_ADMIN_PROJECT_MISMATCH') {
    return { status: 503, message: 'Firebase service account không thuộc project đang cấu hình cho ứng dụng.' };
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN'].includes(error?.code)
    || code === 'app/network-error' || error?.name === 'TypeError') {
    return { status: 503, message: 'Backend không kết nối được Google/Firebase. Kiểm tra mạng backend.' };
  }
  return { status: 502, message: 'Firebase không chấp nhận yêu cầu đổi mật khẩu. Kiểm tra credential, quyền service account và log backend.' };
}

export async function verifyFirebaseIdToken(idToken, checkRevoked = true, options = {}) {
  if (typeof idToken !== 'string' || !idToken.trim()) return null;
  try {
    const auth = options.auth || getAdminAuth();
    return await auth.verifyIdToken(idToken, checkRevoked);
  } catch {
    return null;
  }
}

export async function updateFirebaseUserPassword(uid, password, options = {}) {
  if (typeof uid !== 'string' || !uid.trim()) {
    return { ok: false, status: 400, message: 'Firebase UID của tài khoản không hợp lệ.' };
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { ok: false, status: 400, message: 'Mật khẩu cần có từ 8 đến 128 ký tự.' };
  }
  if (!options.auth && !isFirebaseAdminConfigured()) {
    return {
      ok: false,
      status: 503,
      code: 'FIREBASE_ADMIN_CREDENTIALS_REQUIRED',
      message: 'Backend chưa có Firebase Admin credential. Cấu hình service account hoặc Application Default Credentials rồi khởi động lại backend.',
    };
  }

  let auth;
  try {
    auth = options.auth || getAdminAuth();
    if (options.expectedEmail) {
      const firebaseUser = await auth.getUser(uid);
      if (firebaseUser?.disabled) {
        return { ok: false, status: 409, code: 'FIREBASE_USER_DISABLED', message: 'Tài khoản Firebase đang bị vô hiệu hóa. Hãy xác minh và mở khóa trước khi đặt lại mật khẩu.' };
      }
      const expectedEmail = options.expectedEmail.trim().toLowerCase();
      const actualEmail = String(firebaseUser?.email || '').trim().toLowerCase();
      if (!actualEmail) {
        return { ok: false, status: 409, code: 'FIREBASE_EMAIL_MISSING', message: 'Tài khoản Firebase chưa có email đăng nhập.' };
      }
      if (actualEmail !== expectedEmail) {
        return { ok: false, status: 409, code: 'FIREBASE_ACCOUNT_MISMATCH', message: 'Email Supabase không khớp với tài khoản Firebase. Không đổi mật khẩu để tránh nhầm tài khoản.' };
      }
    }
    const updatedUser = await auth.updateUser(uid, { password });
    if (updatedUser?.uid !== uid) {
      return { ok: false, status: 502, message: 'Firebase không xác nhận đúng tài khoản vừa được cập nhật.' };
    }
  } catch (error) {
    const mapped = mapFirebaseAdminError(error);
    return { ok: false, ...mapped };
  }

  try {
    await auth.revokeRefreshTokens(uid);
    return { ok: true, status: 200, sessionsRevoked: true };
  } catch (error) {
    const mapped = mapFirebaseAdminError(error);
    return {
      ok: false,
      status: mapped.status >= 500 ? mapped.status : 503,
      code: 'FIREBASE_PASSWORD_UPDATED_SESSION_REVOCATION_FAILED',
      passwordUpdated: true,
      sessionsRevoked: false,
      message: 'Firebase đã đổi mật khẩu nhưng không thu hồi được phiên cũ. Không thể xác nhận reset hoàn tất; hãy kiểm tra quyền service account trước khi thử lại.',
    };
  }
}
