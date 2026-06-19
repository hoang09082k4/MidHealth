import http from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { upsertAppUser } from './account_service.js';
import { requirePortal, requireRoles, APP_ROLES } from './authorization_service.js';
import { applyCorsHeaders } from './cors.js';
import {
  deleteHealthArticleAsAdmin,
  getAdminDashboard,
  reviewProviderAsAdmin,
  saveHealthArticleAsAdmin,
  syncCatalogAccountsAsAdmin,
  updateCatalogEntityAsAdmin,
  updateUserAsAdmin,
} from './admin_service.js';
import { config } from './config.js';
import {
  cancelAppointment,
  createAppointment,
  listAppointments,
  listClinicSlots,
  listDoctorSlots,
  listHospitalSlots,
  listPatientProfiles,
  saveMedicalProfile,
} from './appointment_service.js';
import { getCatalog } from './catalog_service.js';
import { getReferenceData } from './reference_service.js';
import {
  hasFirebaseConfig,
  loginWithEmail,
  registerWithEmail,
  resolvePatientEmailByPhone,
  sendPasswordResetEmail,
  verifyIdToken,
} from './firebase_auth.js';
import {
  getHealthArticle,
  getHealthAuthor,
  listFeaturedHealthArticles,
  listHealthArticles,
  listHealthAuthors,
  listHealthCategories,
  listHealthExperts,
  searchHealthArticles,
} from './health_news_service.js';
import { askGeminiChat, hasGeminiConfig } from './gemini_chat_service.js';
import {
  createMoMoAtmPayment,
  handleMoMoIpn,
  handleMoMoReturn,
} from './momo_service.js';
import {
  cancelPayPalOrder,
  capturePayPalOrder,
  createPayPalOrder,
  handlePayPalWebhook,
} from './paypal_service.js';
import {
  consumeOtpToken,
  getUsableOtpToken,
  hasOtpConfig,
  sendEmailOtp,
  verifyEmailOtp,
  verifyOtpToken,
} from './otp_service.js';
import { ensureProfileTableReady, hasCompletePatientProfile, savePatientProfile } from './profile_service.js';
import { scanMedicalCard } from './card_scan_service.js';
import {
  getProviderWorkspace,
  getProviderWorkspaceOperations,
  deleteProviderSlot,
  saveProviderWorkspace,
  saveProviderSlot,
  updateProviderFacilityDetails,
  updateProviderUnavailability,
  updateProviderAppointmentStatus,
  updateProviderSlot,
} from './provider_workspace_service.js';
import {
  createQueueTicket,
  getQueueTicket,
  listQueueTickets,
  updateQueueTicket,
} from './queue_service.js';
import { applySecurityHeaders } from './security_headers.js';
import { hasSupabaseConfig } from './supabase.js';

const chatbotRateLimits = new Map();
const authRateLimits = new Map();
const cardScanRateLimits = new Map();

function getRequestIp(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  return String(Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || request.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function isChatbotRateLimited(request) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;
  const key = getRequestIp(request);
  const current = chatbotRateLimits.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > current.resetAt) {
    chatbotRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  chatbotRateLimits.set(key, current);
  return current.count > limit;
}

function isAuthRateLimited(request) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limit = 12;
  const key = getRequestIp(request);
  const current = authRateLimits.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > current.resetAt) {
    authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  authRateLimits.set(key, current);
  return current.count > limit;
}

function isCardScanRateLimited(request) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limit = 10;
  const key = getRequestIp(request);
  const current = cardScanRateLimits.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > current.resetAt) {
    cardScanRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  cardScanRateLimits.set(key, current);
  return current.count > limit;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function emptyProviderOperations(reason = '') {
  return {
    workspace: null,
    linked: false,
    reason,
    summary: {
      todayAppointments: 0,
      pendingAppointments: 0,
      availableSlots: 0,
      checkedIn: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
    },
    appointments: [],
    slots: [],
    specialties: [],
    services: [],
    report: [],
    activity: [],
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 7 * 1024 * 1024) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function getUserFromRequest(request) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;
  return verifyIdToken(token);
}

async function getUserFromRequestOrPayload(request, payload = {}) {
  const headerUser = await getUserFromRequest(request);
  if (headerUser) return headerUser;

  const bodyToken = typeof payload.idToken === 'string' ? payload.idToken.trim() : '';
  return bodyToken ? verifyIdToken(bodyToken) : null;
}

async function ensurePatientAccess(firebaseUser) {
  let access = await requireRoles(firebaseUser, APP_ROLES.PATIENT);
  if (!access.ok && access.status === 404) {
    access = await upsertAppUser(firebaseUser, {
      authProvider: firebaseUser.providerUserInfo?.[0]?.providerId?.includes('google') ? 'google' : 'password',
      role: APP_ROLES.PATIENT,
      markLogin: true,
      allowPatientIdentityRelink: true,
    });
  }
  return access;
}

async function resolveQueueReadAccess(firebaseUser) {
  if (!firebaseUser) {
    return { ok: false, status: 401, data: { message: 'Ban can dang nhap de xem so kham.' } };
  }

  const privilegedAccess = await requireRoles(firebaseUser, [
    APP_ROLES.ADMIN,
    APP_ROLES.DOCTOR,
    APP_ROLES.CLINIC,
    APP_ROLES.HOSPITAL,
  ]);
  if (privilegedAccess.ok) return { ok: true, privileged: true };

  const patientAccess = await requireRoles(firebaseUser, APP_ROLES.PATIENT);
  if (patientAccess.ok) return { ok: true, privileged: false };

  return patientAccess.status === 404 ? privilegedAccess : patientAccess;
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  applyCorsHeaders(request, response);
  applySecurityHeaders(response, request);

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'midhealth-backend',
      firebase: hasFirebaseConfig ? 'connected' : 'missing-config',
      emailOtp: hasOtpConfig ? 'connected' : 'missing-config',
      supabase: hasSupabaseConfig ? 'connected' : 'missing-config',
      paypal: config.paypalClientId && config.paypalClientSecret ? 'connected' : 'missing-config',
      momo: config.momoPartnerCode && config.momoAccessKey && config.momoSecretKey ? 'connected' : 'missing-config',
      gemini: hasGeminiConfig ? 'connected' : 'missing-config',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/chatbot') {
    if (isChatbotRateLimited(request)) {
      sendJson(response, 429, { message: 'Bạn đang gửi quá nhiều câu hỏi. Vui lòng thử lại sau ít phút.' });
      return;
    }

    try {
      const payload = await readBody(request);
      const user = await getUserFromRequest(request);
      const result = await askGeminiChat(payload, { user });
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu chatbot không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/card-scan') {
    if (isCardScanRateLimited(request)) {
      sendJson(response, 429, { message: 'Bạn đã nhận diện quá nhiều ảnh. Vui lòng thử lại sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await scanMedicalCard(payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu ảnh không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const payload = await readBody(request);
      const otpPayload = getUsableOtpToken(payload.otpToken, payload.email);

      if (!otpPayload || otpPayload.email !== payload.email?.trim().toLowerCase()) {
        sendJson(response, 401, { message: 'Vui lòng xác minh OTP email trước khi đăng ký.' });
        return;
      }

      if (payload.skipProfile) {
        const result = await registerWithEmail(payload);
        if (!result.ok) {
          sendJson(response, result.status, result.data);
          return;
        }

        const providerRole = ['doctor', 'clinic', 'hospital'].includes(payload.accountRole) ? payload.accountRole : null;
        if (providerRole || payload.providerRegistration) {
          const accountResult = await upsertAppUser(result.data, {
            role: providerRole || 'doctor',
            status: 'active',
            fullName: payload.fullName,
            email: payload.email,
            emailVerified: true,
            authProvider: 'password',
          });
          if (!accountResult.ok) {
            sendJson(response, accountResult.status, accountResult.data);
            return;
          }

          consumeOtpToken(payload.otpToken, payload.email);
          sendJson(response, 201, { data: { ...result.data, appUser: accountResult.data } });
          return;
        }

        consumeOtpToken(payload.otpToken, payload.email);
        sendJson(response, 201, { data: result.data });
        return;
      }

      const tableReady = await ensureProfileTableReady();
      if (!tableReady.ok) {
        sendJson(response, tableReady.status, tableReady.data);
        return;
      }

      const result = await registerWithEmail(payload);
      if (!result.ok) {
        sendJson(response, result.status, result.data);
        return;
      }

      const profileResult = await savePatientProfile(result.data, payload);
      if (!profileResult.ok) {
        sendJson(response, profileResult.status, profileResult.data);
        return;
      }

      consumeOtpToken(payload.otpToken, payload.email);

      sendJson(response, 201, {
        data: {
          ...result.data,
          patientProfile: profileResult.data,
        },
      });
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu đăng ký không hợp lệ' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    if (isAuthRateLimited(request)) {
      sendJson(response, 429, { message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      if (!['admin', 'provider', 'patient'].includes(payload.portal)) {
        sendJson(response, 400, { message: 'Thiếu cổng đăng nhập hợp lệ.' });
        return;
      }
      let loginPayload = payload;
      if (payload.portal === 'patient' && payload.phone && !payload.email) {
        const resolved = await resolvePatientEmailByPhone(payload.phone);
        if (!resolved.ok) {
          sendJson(response, resolved.status, resolved.data);
          return;
        }
        loginPayload = { ...payload, email: resolved.data.email };
      }

      const result = await loginWithEmail(loginPayload);
      if (result.ok) {
        let access = await requirePortal(result.data, payload.portal);
        if (!access.ok && payload.portal === 'patient' && access.status === 404) {
          access = await upsertAppUser(result.data, {
            authProvider: 'password',
            email: loginPayload.email,
            role: APP_ROLES.PATIENT,
            markLogin: true,
            allowPatientIdentityRelink: true,
          });
        }
        if (!access.ok) {
          sendJson(response, access.status, access.data);
          return;
        }
        const accountResult = await upsertAppUser(result.data, {
          authProvider: 'password',
          email: loginPayload.email,
          markLogin: true,
          allowPatientIdentityRelink: payload.portal === 'patient',
        });
        if (!accountResult.ok) {
          sendJson(response, accountResult.status, accountResult.data);
          return;
        }

        sendJson(response, 200, { data: { ...result.data, email: loginPayload.email, appUser: accountResult.data } });
        return;
      }

      sendJson(response, result.status, result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu đăng nhập không hợp lệ' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/google') {
    try {
      const payload = await readBody(request);
      const firebaseUser = await verifyIdToken(payload.idToken);
      if (!firebaseUser) {
        sendJson(response, 401, { message: 'Token Google không hợp lệ hoặc đã hết hạn.' });
        return;
      }

      const portal = payload.portal || 'patient';
      let accountResult = await requirePortal(firebaseUser, portal);
      if (!accountResult.ok && portal === 'patient' && accountResult.status === 404) {
        accountResult = await upsertAppUser(firebaseUser, {
          authProvider: 'google',
          role: APP_ROLES.PATIENT,
          markLogin: true,
          allowPatientIdentityRelink: true,
        });
      }
      if (!accountResult.ok) {
        sendJson(response, accountResult.status, accountResult.data);
        return;
      }

      sendJson(response, 200, { data: { ...firebaseUser, appUser: accountResult.data } });
    } catch {
      sendJson(response, 400, { message: 'Token Google không hợp lệ' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/otp/send') {
    if (isAuthRateLimited(request)) {
      sendJson(response, 429, { message: 'Qua nhieu yeu cau xac thuc. Vui long thu lai sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await sendEmailOtp(payload.email);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 500, { message: 'Không thể gửi OTP. Vui lòng thử lại sau.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/password-reset') {
    if (isAuthRateLimited(request)) {
      sendJson(response, 429, { message: 'Qua nhieu yeu cau dat lai mat khau. Vui long thu lai sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const resolved = payload.phone && !payload.email
        ? await resolvePatientEmailByPhone(payload.phone)
        : { ok: true, status: 200, data: { email: payload.email } };
      if (!resolved.ok) {
        sendJson(response, resolved.status, resolved.data);
        return;
      }
      const result = await sendPasswordResetEmail(resolved.data.email);
      sendJson(response, result.status, result.ok ? { data: { email: resolved.data.email } } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu đặt lại mật khẩu không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/otp/verify') {
    try {
      const payload = await readBody(request);
      const result = verifyEmailOtp(payload.email, payload.otp);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu xác thực OTP không hợp lệ' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/otp/me') {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyOtpToken(token);

    if (!payload) {
      sendJson(response, 401, { message: 'JWT OTP không hợp lệ hoặc đã hết hạn' });
      return;
    }

    sendJson(response, 200, { data: { email: payload.email } });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const authHeader = request.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const optionalSessionCheck = url.searchParams.get('optional') === '1';

    if (!idToken) {
      if (optionalSessionCheck) {
        sendJson(response, 200, { data: { allowed: false, reason: 'MISSING_TOKEN' } });
        return;
      }
      sendJson(response, 401, { message: 'Thiếu token đăng nhập' });
      return;
    }

    const firebaseUser = await verifyIdToken(idToken);
    if (!firebaseUser) {
      if (optionalSessionCheck) {
        sendJson(response, 200, { data: { allowed: false, reason: 'INVALID_TOKEN' } });
        return;
      }
      sendJson(response, 401, { message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    const portal = url.searchParams.get('portal');
    if (!portal) {
      sendJson(response, 400, { message: 'Thiếu cổng truy cập cần xác minh.' });
      return;
    }
    let access = await requirePortal(firebaseUser, portal);
    if (!access.ok && portal === 'patient' && access.status === 404) {
      access = await upsertAppUser(firebaseUser, {
        authProvider: firebaseUser.providerUserInfo?.[0]?.providerId?.includes('google') ? 'google' : 'password',
        role: APP_ROLES.PATIENT,
        markLogin: true,
        allowPatientIdentityRelink: true,
      });
    }
    if (!access.ok) {
      if (optionalSessionCheck) {
        sendJson(response, 200, { data: { allowed: false, reason: access.data?.code || 'PORTAL_ACCESS_DENIED' } });
        return;
      }
      sendJson(response, access.status, access.data);
      return;
    }

    const allowIncompletePatient = portal === 'patient'
      && url.searchParams.get('allowIncomplete') === '1';
    if (portal === 'patient' && !allowIncompletePatient) {
      const profileComplete = await hasCompletePatientProfile(firebaseUser);
      if (!profileComplete) {
        if (optionalSessionCheck) {
          sendJson(response, 200, { data: { allowed: false, reason: 'PATIENT_PROFILE_INCOMPLETE' } });
          return;
        }
        sendJson(response, 403, {
          message: 'Tài khoản chưa hoàn tất hồ sơ đăng ký.',
          code: 'PATIENT_PROFILE_INCOMPLETE',
        });
        return;
      }
    }

    sendJson(response, 200, {
      data: {
        uid: firebaseUser.localId,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || access.data.full_name,
        role: access.data.role,
        status: access.data.status,
      },
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }

    const result = await getAdminDashboard(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'PATCH' && url.pathname.match(/^\/api\/admin\/provider-workspaces\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }

    try {
      const workspaceId = decodeURIComponent(url.pathname.replace('/api/admin/provider-workspaces/', ''));
      const payload = await readBody(request);
      const result = await reviewProviderAsAdmin(user, workspaceId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu duyệt hồ sơ không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.match(/^\/api\/admin\/users\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }

    try {
      const userId = decodeURIComponent(url.pathname.replace('/api/admin/users/', ''));
      const payload = await readBody(request);
      const result = await updateUserAsAdmin(user, userId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu cập nhật tài khoản không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname === '/api/admin/catalog-entities') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }

    try {
      const payload = await readBody(request);
      const result = await updateCatalogEntityAsAdmin(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu cập nhật catalog không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/catalog-accounts/sync') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }

    const result = await syncCatalogAccountsAsAdmin(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/health-articles') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await saveHealthArticleAsAdmin(user, '', payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Dữ liệu bài viết không hợp lệ.' });
    }
    return;
  }

  if (url.pathname.match(/^\/api\/admin\/health-articles\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
      return;
    }
    const articleId = decodeURIComponent(url.pathname.replace('/api/admin/health-articles/', ''));
    if (request.method === 'PATCH') {
      try {
        const payload = await readBody(request);
        const result = await saveHealthArticleAsAdmin(user, articleId, payload);
        sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      } catch (error) {
        sendJson(response, 400, { message: error.message || 'Dữ liệu bài viết không hợp lệ.' });
      }
      return;
    }
    if (request.method === 'DELETE') {
      const result = await deleteHealthArticleAsAdmin(user, articleId);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/provider/workspace') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 200, { data: null });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, 200, { data: null });
      return;
    }
    const result = await getProviderWorkspace(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/provider/workspace') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để gửi hồ sơ đối tác.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await saveProviderWorkspace(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu hồ sơ đối tác không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/provider/workspace/operations') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 200, { data: emptyProviderOperations('Chua dang nhap workspace.') });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, 200, { data: emptyProviderOperations('Tai khoan khong thuoc workspace bac si.') });
      return;
    }
    const result = await getProviderWorkspaceOperations(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'PATCH' && url.pathname === '/api/provider/workspace/unavailability') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để cập nhật lịch nghỉ.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await updateProviderUnavailability(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu lịch nghỉ không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname === '/api/provider/workspace/facility-details') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để cập nhật trang hiển thị.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await updateProviderFacilityDetails(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu trang hiển thị không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.match(/^\/api\/provider\/workspace\/appointments\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để cập nhật lịch hẹn.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const appointmentId = decodeURIComponent(url.pathname.replace('/api/provider/workspace/appointments/', ''));
      const payload = await readBody(request);
      const result = await updateProviderAppointmentStatus(user, appointmentId, payload.status);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu cập nhật lịch hẹn không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/provider/workspace/slots') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để cấu hình khung giờ.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await saveProviderSlot(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu khung giờ không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.match(/^\/api\/provider\/workspace\/slots\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để cập nhật khung giờ.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const slotId = decodeURIComponent(url.pathname.replace('/api/provider/workspace/slots/', ''));
      const payload = await readBody(request);
      const result = await updateProviderSlot(user, slotId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu cập nhật khung giờ không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'DELETE' && url.pathname.match(/^\/api\/provider\/workspace\/slots\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lòng đăng nhập để xóa khung giờ.' });
      return;
    }

    const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    try {
      const slotId = decodeURIComponent(url.pathname.replace('/api/provider/workspace/slots/', ''));
      const result = await deleteProviderSlot(user, slotId);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu xóa khung giờ không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/catalog') {
    const result = await getCatalog();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/reference-data') {
    const result = await getReferenceData();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health/categories') {
    const result = await listHealthCategories();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health/articles') {
    const result = await listHealthArticles({
      category: url.searchParams.get('category'),
      keyword: url.searchParams.get('keyword'),
      featured: url.searchParams.get('featured'),
      limit: url.searchParams.get('limit'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health/search') {
    const result = await searchHealthArticles({
      keyword: url.searchParams.get('q'),
      category: url.searchParams.get('category'),
      limit: url.searchParams.get('limit'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health/experts') {
    const result = await listHealthExperts();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/health/authors/')) {
    const authorId = decodeURIComponent(url.pathname.replace('/api/health/authors/', '')).trim();
    const result = await getHealthAuthor(authorId);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/health/articles/')) {
    const identifier = decodeURIComponent(url.pathname.replace('/api/health/articles/', '')).trim();
    const result = await getHealthArticle(identifier);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/categories') {
    const result = await listHealthCategories();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/articles') {
    const result = await listHealthArticles({
      category: url.searchParams.get('category'),
      limit: url.searchParams.get('limit'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/featured') {
    const result = await listFeaturedHealthArticles(url.searchParams.get('limit'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/search') {
    const result = await searchHealthArticles({
      keyword: url.searchParams.get('q'),
      category: url.searchParams.get('category'),
      limit: url.searchParams.get('limit'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/experts') {
    const result = await listHealthExperts();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health-news/authors') {
    const result = await listHealthAuthors();
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/health-news/authors/')) {
    const authorId = decodeURIComponent(url.pathname.replace('/api/health-news/authors/', '')).trim();
    const result = await getHealthAuthor(authorId);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/health-news/articles/')) {
    const identifier = decodeURIComponent(url.pathname.replace('/api/health-news/articles/', '')).trim();
    const result = await getHealthArticle(identifier);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clinics') {
    const result = await getCatalog();
    sendJson(response, result.status, result.ok ? { data: result.data.clinics || [] } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && url.pathname.endsWith('/services')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '').replace('/services', '')).trim();
    const result = await getCatalog();
    const clinic = result.ok ? (result.data.clinics || []).find((item) => item.id === clinicId) : null;
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic.services || [] } : result.ok ? { message: 'Không tìm thấy phòng khám.' } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && url.pathname.endsWith('/specialties')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '').replace('/specialties', '')).trim();
    const result = await getCatalog();
    const clinic = result.ok ? (result.data.clinics || []).find((item) => item.id === clinicId) : null;
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic.specialties || [] } : result.ok ? { message: 'Không tìm thấy phòng khám.' } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && !url.pathname.endsWith('/slots')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '')).trim();
    const result = await getCatalog();
    const clinic = result.ok ? (result.data.clinics || []).find((item) => item.id === clinicId) : null;
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic } : result.ok ? { message: 'Không tìm thấy phòng khám.' } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/doctors/') && url.pathname.endsWith('/slots')) {
    const doctorId = decodeURIComponent(url.pathname.replace('/api/doctors/', '').replace('/slots', '')).trim();
    const result = await listDoctorSlots(doctorId, {
      fromDate: url.searchParams.get('from'),
      days: url.searchParams.get('days'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/hospitals/') && url.pathname.endsWith('/slots')) {
    const hospitalId = decodeURIComponent(url.pathname.replace('/api/hospitals/', '').replace('/slots', '')).trim();
    const result = await listHospitalSlots(hospitalId, {
      fromDate: url.searchParams.get('from'),
      days: url.searchParams.get('days'),
      serviceName: url.searchParams.get('serviceName'),
      specialtyName: url.searchParams.get('specialtyName'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && url.pathname.endsWith('/slots')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '').replace('/slots', '')).trim();
    const result = await listClinicSlots(clinicId, {
      fromDate: url.searchParams.get('from'),
      days: url.searchParams.get('days'),
      serviceName: url.searchParams.get('serviceName'),
      specialtyName: url.searchParams.get('specialtyName'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/patient/profiles') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 200, { data: [] });
      return;
    }

    const access = await ensurePatientAccess(user);
    if (!access.ok) {
      sendJson(response, 200, { data: [] });
      return;
    }
    const result = await listPatientProfiles(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/patient/profiles') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập để lưu hồ sơ bệnh nhân.' });
        return;
      }

      const access = await ensurePatientAccess(user);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const payload = await readBody(request);
      const result = await saveMedicalProfile(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu hồ sơ bệnh nhân không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/patient/profiles/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập để cập nhật hồ sơ bệnh nhân.' });
        return;
      }

      const access = await ensurePatientAccess(user);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const profileId = decodeURIComponent(url.pathname.replace('/api/patient/profiles/', '')).trim();
      const payload = await readBody(request);
      const result = await saveMedicalProfile(user, {
        ...payload,
        profile: {
          ...(payload.profile || payload),
          id: profileId,
        },
      });
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu hồ sơ bệnh nhân không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/appointments') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 200, { data: [] });
      return;
    }

    const access = await ensurePatientAccess(user);
    if (!access.ok) {
      sendJson(response, 200, { data: [] });
      return;
    }
    const result = await listAppointments(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/appointments') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequestOrPayload(request, payload);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập bằng tài khoản bệnh nhân để đặt lịch.' });
        return;
      }
      const access = await ensurePatientAccess(user);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const result = await createAppointment(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu đặt lịch không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/create-order') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequestOrPayload(request, payload);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập bằng tài khoản bệnh nhân để thanh toán.' });
        return;
      }
      const access = await ensurePatientAccess(user);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const result = await createPayPalOrder(user, payload.appointmentId);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu thanh toán không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/momo/create-atm-payment') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequestOrPayload(request, payload);
      if (!user) {
        sendJson(response, 401, { message: 'Ban can dang nhap bang tai khoan benh nhan de thanh toan.' });
        return;
      }
      const access = await ensurePatientAccess(user);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const result = await createMoMoAtmPayment(user, payload.appointmentId);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Du lieu thanh toan MoMo khong hop le.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/return') {
    const orderId = url.searchParams.get('token');
    const result = orderId
      ? await capturePayPalOrder(orderId)
      : { ok: false, status: 400, data: { message: 'Thiếu mã đơn hàng PayPal.' } };
    const redirectUrl = `${config.frontendUrl}?paymentProvider=paypal&paymentStatus=${result.ok ? 'success' : 'failed'}`;
    response.writeHead(302, { Location: redirectUrl });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/cancel') {
    const orderId = url.searchParams.get('token');
    const appointmentId = url.searchParams.get('appointmentId');
    const cancelToken = url.searchParams.get('cancelToken');
    const result = await cancelPayPalOrder(orderId, appointmentId, cancelToken);
    response.writeHead(302, { Location: `${config.frontendUrl}?paymentProvider=paypal&paymentStatus=${result.ok ? 'cancelled' : 'failed'}` });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/momo/return') {
    const orderId = url.searchParams.get('orderId');
    const result = await handleMoMoReturn(orderId);
    const status = result.ok ? 'success' : Number(result.data?.resultCode) === 1006 ? 'cancelled' : 'failed';
    response.writeHead(302, { Location: `${config.frontendUrl}?paymentProvider=momo&paymentStatus=${status}` });
    response.end();
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/momo/ipn') {
    try {
      const payload = await readBody(request);
      const result = await handleMoMoIpn(payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'IPN MoMo khong hop le.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/webhook') {
    try {
      const payload = await readBody(request);
      const result = await handlePayPalWebhook(payload, request.headers);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Webhook PayPal không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.endsWith('/cancel') && url.pathname.startsWith('/api/appointments/')) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Bạn cần đăng nhập để hủy lịch khám.' });
      return;
    }

    const access = await ensurePatientAccess(user);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    const appointmentId = decodeURIComponent(url.pathname.replace('/api/appointments/', '').replace('/cancel', '')).trim();
    const result = await cancelAppointment(user, appointmentId);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/queue') {
    const user = await getUserFromRequest(request);
    const access = await resolveQueueReadAccess(user);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    const result = await listQueueTickets({ firebaseUser: user, privileged: access.privileged });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/queue/')) {
    const user = await getUserFromRequest(request);
    const access = await resolveQueueReadAccess(user);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    const result = await getQueueTicket(url.pathname.replace('/api/queue/', ''), {
      firebaseUser: user,
      privileged: access.privileged,
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/queue') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập bằng tài khoản bệnh nhân.' });
        return;
      }
      const access = await requireRoles(user, APP_ROLES.PATIENT);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const result = await createQueueTicket(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/queue/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Bạn cần đăng nhập bằng tài khoản đối tác y tế.' });
        return;
      }
      const access = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const payload = await readBody(request);
      const result = await updateQueueTicket(url.pathname.replace('/api/queue/', ''), payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Endpoint không tồn tại' });
}

const server = http.createServer(handleRequest);

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Cổng ${config.port} đang được sử dụng. Backend MidHealth có thể đã chạy sẵn; hãy dùng instance hiện tại hoặc đặt PORT khác trong .env.`);
    process.exit(1);
  }
  throw error;
});

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  server.listen(config.port, () => {
    console.log(`MidHealth backend listening on http://localhost:${config.port}`);
  });
}
