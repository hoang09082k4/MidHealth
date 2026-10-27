import { getAdminSchedule, saveAdminSlot, updateAdminSlot, updateAdminUnavailability } from './admin_schedule_service.js';
import { createDoctorAccount } from './doctor_account_service.js';
import { getDoctorWorkspace, getDoctorReport, updateDoctorProfile, completeDoctorVisit, appendClinicalNoteAddendum, recordSpecialtyExam, saveSpecialtyExamDetails, updatePatientHealthProfileFromEncounter, getDoctorReferralSlots, getDoctorSchedule, saveDoctorSlot, changeDoctorSlot, getDepartmentDoctors } from './doctor_service.js';
import { getClinic, saveClinic } from './clinic_service.js';
import { listStaffAppointments, checkInByCode, listCounterPatients, listCounterSlots, createCounterBooking, createPatientAtCounter, updatePatientAtCounter } from './staff_service.js';
import { createStaffAccount } from './staff_account_service.js';
import { getClinicActivityReport } from './clinic_report_service.js';
import { getDepartmentOperations, createDepartmentTask, updateDepartmentTask } from './department_operations_service.js';
import { getClinicCatalogAdmin, saveClinicCatalogEntry, uploadClinicCatalogImage } from './clinic_catalog_service.js';
import http from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { upsertAppUser } from './account_service.js';
import { isFirebaseAdminConfigured } from './firebase_admin_auth.js';
import { requirePortal, requireRoles, APP_ROLES } from './authorization_service.js';
import { applyCorsHeaders } from './cors.js';
import {
  getAdminDashboard,
  getAdminAuditEvents,
  updateUserAsAdmin,
  resetClinicUserPasswordAsAdmin,
  updateAppointmentAsAdmin,
  checkInAppointmentAsAdmin,
  updateVisitDisruptionAsAdmin,
  rescheduleAppointmentAsAdmin,
} from './admin_service.js';
import { config, missingBackendConfig } from './config.js';
import {
  cancelAppointment,
  createAppointment,
  expireStalePendingPayments,
  listAppointments,
  listDoctorSlots,
  listPatientProfiles,
  processAppointmentEmailOutbox,
  saveMedicalProfile,
  reschedulePatientAppointment,
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
  cancelPayPalOrder,
  capturePayPalOrder,
  createPayPalOrder,
  handlePayPalWebhook,
  reconcilePendingPayPalOrders,
} from './paypal_service.js';
import {
  consumeOtpToken,
  hasOtpConfig,
  sendEmailOtp,
  verifyEmailOtp,
  verifyOtpToken,
} from './otp_service.js';
import { ensureProfileTableReady, hasCompletePatientProfile, savePatientProfile } from './profile_service.js';
import { scanMedicalCard } from './card_scan_service.js';

import {
  getQueueTicket,
  listQueueTickets,
  updateQueueTicket,
} from './queue_service.js';
import { createRateLimiter } from './rate_limit.js';
import { applySecurityHeaders } from './security_headers.js';
import { serveStaticSite } from './static_site.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const authLimiter = createRateLimiter({ limit: 12, windowMs: 15 * 60000 });
const cardScanLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60000 });

export function getRequestIp(request) {
  const forwardedFor = config.trustProxy ? request.headers['x-forwarded-for'] : '';
  return String(Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || request.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function sendPublicResult(request, response, result, data, seconds = 30) {
  if (result.ok && result.status === 200 && data?.source !== 'unavailable'
    && !request.headers.authorization && !request.headers.cookie) {
    response.setHeader('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`);
  }
  sendJson(response, result.status, result.ok ? { data } : result.data);
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
        const payload = body ? JSON.parse(body) : {};
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('JSON body must be an object.');
        }
        resolve(payload);
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new Error('Request aborted.')));
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
  ]);
  if (privilegedAccess.ok) return { ok: true, privileged: true };

  const patientAccess = await requireRoles(firebaseUser, APP_ROLES.PATIENT);
  if (patientAccess.ok) return { ok: true, privileged: false };

  return patientAccess.status === 404 ? privilegedAccess : patientAccess;
}

async function routeRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  applyCorsHeaders(request, response);
  applySecurityHeaders(response, request);
  response.setHeader('Cache-Control', 'private, no-store');

  try {
    decodeURIComponent(url.pathname);
  } catch {
    sendJson(response, 400, { message: 'ÄÆ°á»ng dáº«n khÃ´ng há»£p lá»‡.' });
    return;
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const missingConfig = missingBackendConfig();
    sendJson(response, 200, {
      status: 'ok',
      service: 'midhealth-backend',
      firebaseClient: hasFirebaseConfig ? 'configured' : 'missing-config',
      firebaseAdmin: isFirebaseAdminConfigured() ? 'configured' : 'missing-config',
      emailOtp: hasOtpConfig ? 'configured' : 'missing-config',
      supabase: hasSupabaseConfig ? 'configured' : 'missing-config',
      paypal: config.paypalClientId && config.paypalClientSecret ? 'configured' : 'missing-config',
      missingConfig,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/card-scan') {
    if (cardScanLimiter(getRequestIp(request))) {
      sendJson(response, 429, { message: 'Báº¡n Ä‘Ã£ nháº­n diá»‡n quÃ¡ nhiá»u áº£nh. Vui lÃ²ng thá»­ láº¡i sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await scanMedicalCard(payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u áº£nh khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const payload = await readBody(request);
      if (payload.providerRegistration || (payload.accountRole && payload.accountRole !== 'patient')) { sendJson(response, 403, { message: 'ÄÄƒng kÃ½ cÃ´ng khai chá»‰ dÃ nh cho ngÆ°á»i dÃ¹ng.' }); return; }
      const otpPayload = verifyOtpToken(payload.otpToken);

      if (!otpPayload || otpPayload.email !== payload.email?.trim().toLowerCase()) {
        sendJson(response, 401, { message: 'Vui lÃ²ng xÃ¡c minh OTP email trÆ°á»›c khi Ä‘Äƒng kÃ½.' });
        return;
      }

      if (payload.skipProfile) {
        if (!await consumeOtpToken(payload.otpToken, payload.email)) {
          sendJson(response, 401, { message: 'OTP Ä‘Ã£ háº¿t háº¡n hoáº·c Ä‘Ã£ sá»­ dá»¥ng. Vui lÃ²ng xÃ¡c minh láº¡i.' });
          return;
        }
        const result = await registerWithEmail(payload);
        if (!result.ok) {
          sendJson(response, result.status, result.data);
          return;
        }

        sendJson(response, 201, { data: result.data });
        return;
      }

      const tableReady = await ensureProfileTableReady();
      if (!tableReady.ok) {
        sendJson(response, tableReady.status, tableReady.data);
        return;
      }

      if (!await consumeOtpToken(payload.otpToken, payload.email)) {
        sendJson(response, 401, { message: 'OTP Ä‘Ã£ háº¿t háº¡n hoáº·c Ä‘Ã£ sá»­ dá»¥ng. Vui lÃ²ng xÃ¡c minh láº¡i.' });
        return;
      }
      const result = await registerWithEmail(payload);
      if (!result.ok) {
        sendJson(response, result.status, result.data);
        return;
      }

      // The one-time email code was validated and consumed above. Preserve this
      // server-verified proof for the patient account even if Firebase's own
      // emailVerified claim has not yet been refreshed on the client token.
      const profileResult = await savePatientProfile({ ...result.data, emailVerifiedByOtp: true }, payload);
      if (!profileResult.ok) {
        sendJson(response, profileResult.status, profileResult.data);
        return;
      }

      sendJson(response, 201, {
        data: {
          ...result.data,
          patientProfile: profileResult.data,
        },
      });
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u Ä‘Äƒng kÃ½ khÃ´ng há»£p lá»‡' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    if (authLimiter(getRequestIp(request))) {
      sendJson(response, 429, { message: 'QuÃ¡ nhiá»u láº§n Ä‘Äƒng nháº­p. Vui lÃ²ng thá»­ láº¡i sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      if (!['admin', 'patient', 'doctor', 'account'].includes(payload.portal)) {
        sendJson(response, 400, { message: 'Thiáº¿u cá»•ng Ä‘Äƒng nháº­p há»£p lá»‡.' });
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
        if (!access.ok && ['patient', 'account'].includes(payload.portal) && access.status === 404) {
          access = await upsertAppUser(result.data, {
            authProvider: 'password',
            email: loginPayload.email,
            role: APP_ROLES.PATIENT,
            markLogin: true,
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
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/google') {
    try {
      const payload = await readBody(request);
      const firebaseUser = await verifyIdToken(payload.idToken);
      if (!firebaseUser) {
        sendJson(response, 401, { message: 'Token Google khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.' });
        return;
      }

      const portal = payload.portal || 'patient';
      let accountResult = await requirePortal(firebaseUser, portal);
      if (!accountResult.ok && ['patient', 'account'].includes(portal) && accountResult.status === 404) {
        accountResult = await upsertAppUser(firebaseUser, {
          authProvider: 'google',
          role: APP_ROLES.PATIENT,
          markLogin: true,
        });
      }
      if (!accountResult.ok) {
        sendJson(response, accountResult.status, accountResult.data);
        return;
      }

      sendJson(response, 200, { data: { ...firebaseUser, appUser: accountResult.data } });
    } catch {
      sendJson(response, 400, { message: 'Token Google khÃ´ng há»£p lá»‡' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/otp/send') {
    if (authLimiter(getRequestIp(request))) {
      sendJson(response, 429, { message: 'Qua nhieu yeu cau xac thuc. Vui long thu lai sau.' });
      return;
    }
    try {
      const payload = await readBody(request);
      const result = await sendEmailOtp(payload.email);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 500, { message: 'KhÃ´ng thá»ƒ gá»­i OTP. Vui lÃ²ng thá»­ láº¡i sau.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/password-reset') {
    if (authLimiter(getRequestIp(request))) {
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
      const { data: doctorLogin } = await supabase.from('app_users').select('id').eq('email', resolved.data.email).in('role', ['doctor', 'head']).maybeSingle();
      if (doctorLogin) {
        sendJson(response, 400, { message: 'TÃ i khoáº£n bÃ¡c sÄ© Ä‘á»“ Ã¡n khÃ´ng cÃ³ há»™p thÆ° nháº­n email. LiÃªn há»‡ admin phÃ²ng khÃ¡m Ä‘á»ƒ xá»­ lÃ½ máº­t kháº©u.' });
        return;
      }
      const result = await sendPasswordResetEmail(resolved.data.email);
      sendJson(response, result.status, result.ok ? { data: { email: resolved.data.email } } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u Ä‘áº·t láº¡i máº­t kháº©u khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/otp/verify') {
    try {
      const payload = await readBody(request);
      const result = await verifyEmailOtp(payload.email, payload.otp);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u xÃ¡c thá»±c OTP khÃ´ng há»£p lá»‡' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/otp/me') {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyOtpToken(token);

    if (!payload) {
      sendJson(response, 401, { message: 'JWT OTP khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n' });
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
      sendJson(response, 401, { message: 'Thiáº¿u token Ä‘Äƒng nháº­p' });
      return;
    }

    const firebaseUser = await verifyIdToken(idToken);
    if (!firebaseUser) {
      if (optionalSessionCheck) {
        sendJson(response, 200, { data: { allowed: false, reason: 'INVALID_TOKEN' } });
        return;
      }
      sendJson(response, 401, { message: 'PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.' });
      return;
    }

    const portal = url.searchParams.get('portal');
    if (!portal) {
      sendJson(response, 400, { message: 'Thiáº¿u cá»•ng truy cáº­p cáº§n xÃ¡c minh.' });
      return;
    }
    let access = await requirePortal(firebaseUser, portal);
    if (!access.ok && portal === 'patient' && access.status === 404) {
      access = await upsertAppUser(firebaseUser, {
        authProvider: firebaseUser.providerUserInfo?.[0]?.providerId?.includes('google') ? 'google' : 'password',
        role: APP_ROLES.PATIENT,
        markLogin: true,
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
          message: 'TÃ i khoáº£n chÆ°a hoÃ n táº¥t há»“ sÆ¡ Ä‘Äƒng kÃ½.',
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

  if (request.method === 'PATCH' && /^\/api\/admin\/appointments\/[^/]+$/.test(url.pathname)) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p quáº£n trá»‹ viÃªn.' }); return; }
    try {
      const result = await updateAppointmentAsAdmin(user, url.pathname.split('/').pop(), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u lá»‹ch háº¹n khÃ´ng há»£p lá»‡.' }); }
    return;
  }

  if (request.method === 'POST' && /^\/api\/admin\/appointments\/[^/]+\/(check-in|disruption|reschedule)$/.test(url.pathname)) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p quáº£n trá»‹ viÃªn.' }); return; }
    try {
      const parts = url.pathname.split('/');
      const action = parts.pop();
      const appointmentId = parts.pop();
      const payload = await readBody(request);
      const result = action === 'check-in'
        ? await checkInAppointmentAsAdmin(user, appointmentId, payload)
        : action === 'reschedule'
            ? await rescheduleAppointmentAsAdmin(user, appointmentId, payload)
            : await updateVisitDisruptionAsAdmin(user, appointmentId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u tiáº¿p nháº­n hoáº·c káº¿t quáº£ khÃ¡m khÃ´ng há»£p lá»‡.' }); }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/doctor-accounts') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p admin.' }); return; }
    try {
      const result = await createDoctorAccount(user, await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u tÃ i khoáº£n bÃ¡c sÄ© khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/staff-accounts') {
    try {
      const result = await createStaffAccount(await getUserFromRequest(request), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u tÃ i khoáº£n nhÃ¢n viÃªn khÃ´ng há»£p lá»‡.' }); }
    return;
  }

  if (url.pathname === '/api/staff/appointments' && request.method === 'GET') {
    const result = await listStaffAppointments(await getUserFromRequest(request), url.searchParams.get('code'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/reports/clinic' && request.method === 'GET') {
    const result = await getClinicActivityReport(await getUserFromRequest(request), {
      from: url.searchParams.get('from'), to: url.searchParams.get('to'),
      specialtyId: url.searchParams.get('specialtyId'), doctorId: url.searchParams.get('doctorId'),
    });
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/staff/check-in' && request.method === 'POST') {
    try {
      const result = await checkInByCode(await getUserFromRequest(request), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u check-in khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (url.pathname === '/api/staff/patients' && request.method === 'GET') {
    const result = await listCounterPatients(await getUserFromRequest(request), url.searchParams.get('query'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/staff/patients' && request.method === 'POST') {
    try {
      const result = await createPatientAtCounter(await getUserFromRequest(request), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Há»“ sÆ¡ bá»‡nh nhÃ¢n khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (/^\/api\/staff\/patients\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') {
    try {
      const result = await updatePatientAtCounter(await getUserFromRequest(request), url.pathname.split('/').pop(), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Há»“ sÆ¡ bá»‡nh nhÃ¢n khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (url.pathname === '/api/staff/slots' && request.method === 'GET') {
    const result = await listCounterSlots(await getUserFromRequest(request), url.searchParams.get('date'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/staff/bookings' && request.method === 'POST') {
    try {
      const result = await createCounterBooking(await getUserFromRequest(request), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Dá»¯ liá»‡u Ä‘Äƒng kÃ½ táº¡i quáº§y khÃ´ng há»£p lá»‡.' }); }
    return;
  }

  if (url.pathname === '/api/doctor/workspace' && request.method === 'GET') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    const result = await getDoctorWorkspace(user, url.searchParams.get('date'), url.searchParams.get('page') || 1, url.searchParams.get('status') || '', url.searchParams.get('search') || '');
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/doctor/report' && request.method === 'GET') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    const result = await getDoctorReport(user, url.searchParams.get('from'), url.searchParams.get('to'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/doctor/profile' && request.method === 'PATCH') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    try {
      const result = await updateDoctorProfile(user, await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Há»“ sÆ¡ bÃ¡c sÄ© khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (url.pathname === '/api/doctor/profile/image' && request.method === 'POST') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    try {
      const result = await uploadClinicCatalogImage(user, { ...(await readBody(request)), kind: 'doctor' });
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'áº¢nh bÃ¡c sÄ© khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (/^\/api\/doctor\/appointments\/[^/]+\/complete$/.test(url.pathname) && request.method === 'POST') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    try {
      const result = await completeDoctorVisit(user, url.pathname.split('/')[4], await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Káº¿t quáº£ khÃ¡m khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (/^\/api\/doctor\/appointments\/[^/]+\/addenda$/.test(url.pathname) && request.method === 'POST') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập trưởng khoa.' }); return; }
    try {
      const result = await appendClinicalNoteAddendum(user, url.pathname.split('/')[4], await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Không thể lưu nội dung bổ sung hồ sơ.' }); }
    return;
  }
  if (/^\/api\/doctor\/encounters\/[^/]+\/result$/.test(url.pathname) && request.method === 'POST') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    try {
      const result = await recordSpecialtyExam(user, url.pathname.split('/')[4], await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Káº¿t quáº£ khÃ¡m chuyÃªn khoa khÃ´ng há»£p lá»‡.' }); }
    return;
  }
  if (/^\/api\/doctor\/encounters\/[^/]+\/result-details$/.test(url.pathname) && request.method === 'POST') {
    const user = await authenticateRequest(request);
    if (!user) return sendJson(response, 401, { message: 'Vui lòng đăng nhập lại.' });
    try {
      const result = await saveSpecialtyExamDetails(user, url.pathname.split('/')[4], await readBody(request));
      return sendServiceResult(response, result);
    } catch (error) { return sendJson(response, 500, { message: 'Không thể lưu chi tiết kết quả khám.' }); }
  }
  if (/^\/api\/doctor\/encounters\/[^/]+\/patient-health-profile$/.test(url.pathname) && request.method === 'POST') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập bác sĩ.' }); return; }
    try {
      const result = await updatePatientHealthProfileFromEncounter(user, url.pathname.split('/')[4], await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Không thể cập nhật hồ sơ sức khỏe.' }); }
    return;
  }
  if (url.pathname === '/api/doctor/referral-slots' && request.method === 'GET') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập bác sĩ.' }); return; }
    const result = await getDoctorReferralSlots(user, url.searchParams.get('specialtyId'), url.searchParams.get('date'));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  const doctorSlotMatch = url.pathname.match(/^\/api\/doctor\/slots(?:\/([^/]+))?$/);
  if (url.pathname === '/api/doctor/department-doctors' && request.method === 'GET') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập.' }); return; }
    const result = await getDepartmentDoctors(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/doctor/department/tasks' && request.method === 'GET') {
    const result = await getDepartmentOperations(await getUserFromRequest(request));
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }
  if (url.pathname === '/api/doctor/department/tasks' && request.method === 'POST') {
    try {
      const result = await createDepartmentTask(await getUserFromRequest(request), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Thông tin công việc không hợp lệ.' }); }
    return;
  }
  if (/^\/api\/doctor\/department\/tasks\/[0-9a-f-]+$/i.test(url.pathname) && request.method === 'PATCH') {
    try {
      const result = await updateDepartmentTask(await getUserFromRequest(request), url.pathname.split('/').pop(), await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Không thể cập nhật trạng thái công việc.' }); }
    return;
  }
  if (doctorSlotMatch && ['GET', 'POST', 'PATCH'].includes(request.method)) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p bÃ¡c sÄ©.' }); return; }
    try {
      const result = request.method === 'GET' && !doctorSlotMatch[1]
        ? await getDoctorSchedule(user, url.searchParams.get('from'), url.searchParams.get('to'), url.searchParams.get('doctorId'))
        : request.method === 'POST' && !doctorSlotMatch[1]
          ? await saveDoctorSlot(user, await readBody(request), url.searchParams.get('doctorId'))
          : request.method === 'PATCH' && doctorSlotMatch[1]
            ? await changeDoctorSlot(user, doctorSlotMatch[1], await readBody(request), url.searchParams.get('doctorId'))
            : { ok: false, status: 405, data: { message: 'PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.' } };
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'Khung giá» khÃ´ng há»£p lá»‡.' }); }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n admin.' });
      return;
    }

    const result = await getAdminDashboard(user);

    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/audit-events') {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' }); return; }
    try {
      const result = await getAdminAuditEvents(user, {
        page: url.searchParams.get('page'), pageSize: url.searchParams.get('pageSize'),
        eventType: url.searchParams.get('eventType'), actorRole: url.searchParams.get('actorRole'),
        from: url.searchParams.get('from'), to: url.searchParams.get('to'),
      });
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 500, { message: 'Không thể tải nhật ký quản trị.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.match(/^\/api\/admin\/users\/[^/]+$/)) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n admin.' });
      return;
    }

    try {
      const userId = decodeURIComponent(url.pathname.replace('/api/admin/users/', ''));
      const payload = await readBody(request);
      const result = await updateUserAsAdmin(user, userId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u cáº­p nháº­t tÃ i khoáº£n khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname.match(/^\/api\/admin\/users\/[^/]+\/password-reset$/)) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' }); return; }
    try {
      const userId = decodeURIComponent(url.pathname.split('/')[4]);
      const payload = await readBody(request);
      const result = await resetClinicUserPasswordAsAdmin(user, userId, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch (error) {
      console.error('Admin password reset route failed:', error?.code || error?.name || 'Unknown error');
      const invalidBody = error instanceof SyntaxError || error?.message === 'Request body too large.';
      sendJson(response, invalidBody ? 400 : 500, {
        message: invalidBody
          ? 'Dữ liệu đặt lại mật khẩu không hợp lệ. Hãy kiểm tra lại các trường.'
          : 'Backend gặp lỗi khi cấp lại mật khẩu. Hãy kiểm tra log backend để biết nguyên nhân.',
      });
    }
    return;
  }

  const scheduleMatch = url.pathname.match(/^\/api\/admin\/doctors\/([^/]+)\/(slots|unavailability)(?:\/([^/]+))?$/);
  if (scheduleMatch) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lÃ²ng Ä‘Äƒng nháº­p quáº£n trá»‹ viÃªn.' }); return; }
    const [, doctorId, resource, slotId] = scheduleMatch;
    try {
      let result;
      if (resource === 'slots' && request.method === 'GET' && !slotId) result = await getAdminSchedule(user, doctorId, url.searchParams.get('from'), url.searchParams.get('to'));
      else if (resource === 'slots' && request.method === 'POST' && !slotId) result = await saveAdminSlot(user, { ...await readBody(request), doctorId });
      else if (resource === 'slots' && request.method === 'PATCH' && slotId) result = await updateAdminSlot(user, doctorId, slotId, await readBody(request));
      else if (resource === 'unavailability' && request.method === 'PATCH' && !slotId) result = await updateAdminUnavailability(user, doctorId, await readBody(request));
      else { sendJson(response, 405, { message: 'PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.' }); return; }
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'KhÃ´ng thá»ƒ cáº­p nháº­t lá»‹ch lÃ m viá»‡c.' }); }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clinic') {
    try {
      const clinic = await getClinic();
      sendPublicResult(request, response, { ok: true, status: 200 }, clinic);
    }
    catch { sendJson(response, 503, { message: 'KhÃ´ng thá»ƒ táº£i thÃ´ng tin phÃ²ng khÃ¡m.' }); }
    return;
  }
  if (['GET', 'POST'].includes(request.method) && url.pathname === '/api/admin/clinic/catalog') {
    try {
      const user = await getUserFromRequest(request);
      const result = request.method === 'GET' ? await getClinicCatalogAdmin(user) : await saveClinicCatalogEntry(user, await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'KhÃ´ng thá»ƒ xá»­ lÃ½ danh má»¥c phÃ²ng khÃ¡m.' }); }
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/clinic/catalog/image') {
    try {
      const user = await getUserFromRequest(request);
      const result = await uploadClinicCatalogImage(user, await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'KhÃ´ng thá»ƒ xá»­ lÃ½ áº£nh phÃ²ng khÃ¡m.' }); }
    return;
  }
  if (request.method === 'PUT' && url.pathname === '/api/admin/clinic') {
    try {
      const user = await getUserFromRequest(request);
      const result = await saveClinic(user, await readBody(request));
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch { sendJson(response, 400, { message: 'KhÃ´ng thá»ƒ lÆ°u thÃ´ng tin phÃ²ng khÃ¡m.' }); }
    return;
  }
  if (request.method === 'GET' && ['/api/doctors', '/api/specialties', '/api/services'].includes(url.pathname)) {
    const result = await getCatalog();
    const data = result.ok ? result.data[url.pathname.slice(5)] : undefined;
    if (result.data?.source === 'unavailable') sendJson(response, result.status, { data });
    else sendPublicResult(request, response, result, data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/catalog') {
    const result = await getCatalog();
    sendPublicResult(request, response, result, result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/reference-data') {
    const result = await getReferenceData();
    sendPublicResult(request, response, result, result.data, 300);
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

  if (request.method === 'GET' && url.pathname === '/api/patient/profiles') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ xem há»“ sÆ¡ bá»‡nh nhÃ¢n.' });
      return;
    }

    const access = await ensurePatientAccess(user);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
      return;
    }
    const result = await listPatientProfiles(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/patient/account-profile') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) { sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ lÆ°u há»“ sÆ¡ Ä‘Äƒng kÃ½.' }); return; }
      const access = await ensurePatientAccess(user);
      if (!access.ok) { sendJson(response, access.status, access.data); return; }
      const payload = await readBody(request);
      if (!user.emailVerified) {
        const otpPayload = verifyOtpToken(payload.otpToken);
        if (!otpPayload || otpPayload.email !== String(user.email || '').trim().toLowerCase()
          || !await consumeOtpToken(payload.otpToken, user.email)) {
          sendJson(response, 401, { message: 'Cần xác minh email bằng mã OTP còn hiệu lực trước khi liên kết hồ sơ.' });
          return;
        }
        user.emailVerifiedByOtp = true;
      }
      const result = await savePatientProfile(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch (error) {
      sendJson(response, 500, { message: error.message || 'KhÃ´ng thá»ƒ lÆ°u há»“ sÆ¡ Ä‘Äƒng kÃ½.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/patient/profiles') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ lÆ°u há»“ sÆ¡ bá»‡nh nhÃ¢n.' });
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
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u há»“ sÆ¡ bá»‡nh nhÃ¢n khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/patient/profiles/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ cáº­p nháº­t há»“ sÆ¡ bá»‡nh nhÃ¢n.' });
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
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u há»“ sÆ¡ bá»‡nh nhÃ¢n khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/appointments') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ xem lá»‹ch khÃ¡m.' });
      return;
    }

    const access = await ensurePatientAccess(user);
    if (!access.ok) {
      sendJson(response, access.status, access.data);
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
        sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n bá»‡nh nhÃ¢n Ä‘á»ƒ Ä‘áº·t lá»‹ch.' });
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
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u Ä‘áº·t lá»‹ch khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/create-order') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequestOrPayload(request, payload);
      if (!user) {
        sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n bá»‡nh nhÃ¢n Ä‘á»ƒ thanh toÃ¡n.' });
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
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u thanh toÃ¡n khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/return') {
    const orderId = url.searchParams.get('token');
    const result = orderId
      ? await capturePayPalOrder(orderId)
      : { ok: false, status: 400, data: { message: 'Thiáº¿u mÃ£ Ä‘Æ¡n hÃ ng PayPal.' } };
    const redirectUrl = `${config.frontendUrl}?paymentProvider=paypal&paymentStatus=${result.ok ? 'success' : result.data?.code === 'PAYMENT_REVIEW_REQUIRED' ? 'review' : result.data?.code === 'PAYMENT_PENDING' ? 'pending' : 'failed'}`;
    response.writeHead(302, { Location: redirectUrl });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/cancel') {
    const orderId = url.searchParams.get('token');
    const appointmentId = url.searchParams.get('appointmentId');
    const cancelToken = url.searchParams.get('cancelToken');
    const result = await cancelPayPalOrder(orderId, appointmentId, cancelToken);
    response.writeHead(302, { Location: `${config.frontendUrl}?paymentProvider=paypal&paymentStatus=${result.ok ? 'pending' : 'failed'}` });
    response.end();
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/webhook') {
    try {
      const payload = await readBody(request);
      const result = await handlePayPalWebhook(payload, request.headers);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Webhook PayPal khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.endsWith('/cancel') && url.pathname.startsWith('/api/appointments/')) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ há»§y lá»‹ch khÃ¡m.' });
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

  if (request.method === 'PATCH' && url.pathname.endsWith('/reschedule') && url.pathname.startsWith('/api/appointments/')) {
    const user = await getUserFromRequest(request);
    if (!user) { sendJson(response, 401, { message: 'Vui lòng đăng nhập để đổi lịch khám.' }); return; }
    const access = await ensurePatientAccess(user);
    if (!access.ok) { sendJson(response, access.status, access.data); return; }
    let payload;
    try { payload = await readBody(request); }
    catch { sendJson(response, 400, { message: 'Yêu cầu đổi lịch không hợp lệ.' }); return; }
    const appointmentId = decodeURIComponent(url.pathname.replace('/api/appointments/', '').replace('/reschedule', '')).trim();
    const result = await reschedulePatientAppointment(user, appointmentId, payload.slotId);
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

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/queue/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n quáº£n trá»‹.' });
        return;
      }
      const access = await requireRoles(user, [APP_ROLES.ADMIN]);
      if (!access.ok) {
        sendJson(response, access.status, access.data);
        return;
      }
      const payload = await readBody(request);
      const result = await updateQueueTicket(url.pathname.replace('/api/queue/', ''), payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dá»¯ liá»‡u gá»­i lÃªn khÃ´ng há»£p lá»‡.' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Endpoint khÃ´ng tá»“n táº¡i' });
}

export async function handleRequest(request, response) {
  try {
    await routeRequest(request, response);
  } catch {
    if (response.headersSent) {
      response.end();
      return;
    }
    sendJson(response, 503, { message: 'Dá»‹ch vá»¥ táº¡m thá»i khÃ´ng kháº£ dá»¥ng. Vui lÃ²ng thá»­ láº¡i sau.' });
  }
}

export const server = http.createServer((request, response) => {
  if (/^\/api(?:\/|$)/.test(request.url || '')) return handleRequest(request, response);
  return serveStaticSite(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Cá»•ng ${config.port} Ä‘ang Ä‘Æ°á»£c sá»­ dá»¥ng. Backend MidHealth cÃ³ thá»ƒ Ä‘Ã£ cháº¡y sáºµn; hÃ£y dÃ¹ng instance hiá»‡n táº¡i hoáº·c Ä‘áº·t PORT khÃ¡c trong .env.`);
    process.exit(1);
  }
  throw error;
});

export function startServer({ runBackgroundWorkers = true } = {}) {
  server.listen(config.port, () => {
    console.log(`MidHealth backend listening on http://localhost:${config.port}`);
  });
  if (!runBackgroundWorkers) return;
  const runEmailWorker = () => processAppointmentEmailOutbox().catch(error => {
    console.warn('Appointment email worker failed:', error?.code || error?.message || 'unknown error');
  });
  setTimeout(runEmailWorker, 5000);
  setInterval(runEmailWorker, 60_000);
  const runPaymentExpiry = async () => {
    try {
      const results = await Promise.all([expireStalePendingPayments(), reconcilePendingPayPalOrders()]);
      for (const result of results) {
        if (!result.ok) console.warn('Payment reconciliation failed:', result.data?.message || 'unknown error');
      }
    } catch (error) {
      console.warn('Payment reconciliation failed:', error?.code || error?.message || 'unknown error');
    }
  };
  setTimeout(runPaymentExpiry, 5000);
  setInterval(runPaymentExpiry, 60_000);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) startServer();
