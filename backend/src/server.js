import http from 'node:http';
import { URL } from 'node:url';
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
  lookupAccount,
  registerWithEmail,
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
import {
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
import { ensureProfileTableReady, savePatientProfile } from './profile_service.js';
import { hasSupabaseConfig } from './supabase.js';
import { queueTickets } from './tickets.js';

let tickets = [...queueTickets];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
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

function normalizeTicket(ticketCode) {
  return decodeURIComponent(ticketCode || '').trim().toUpperCase();
}

async function getUserFromRequest(request) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;

  const result = await lookupAccount(token);
  if (!result.ok) return null;
  return result.data.users?.[0] || null;
}

function createTicket(payload) {
  const nextNumber = Math.max(...tickets.map((ticket) => ticket.number), 0) + 1;
  const ticket = {
    ticket: `MH-${String(1000 + nextNumber).slice(-4)}`,
    patient: payload.patient || 'Bệnh nhân mới',
    department: payload.department || 'Khám tổng quát',
    doctor: payload.doctor || 'Chờ phân bác sĩ',
    room: payload.room || 'Đang cập nhật',
    number: nextNumber,
    current: Math.max(nextNumber - 6, 1),
    status: 'Đang chờ',
    eta: 'Đang tính toán',
    ownerId: payload.ownerId || null,
    createdAt: new Date().toISOString(),
  };

  tickets = [...tickets, ticket];
  return ticket;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

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
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const payload = await readBody(request);
      const otpPayload = getUsableOtpToken(payload.otpToken, payload.email);

      if (!otpPayload || otpPayload.email !== payload.email?.trim().toLowerCase()) {
        sendJson(response, 401, { message: 'Vui lòng xác minh OTP email trước khi đăng ký' });
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
    try {
      const payload = await readBody(request);
      const result = await loginWithEmail(payload);
      sendJson(response, result.ok ? 200 : result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu đăng nhập không hợp lệ' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/google') {
    try {
      const payload = await readBody(request);
      const result = await lookupAccount(payload.idToken);
      sendJson(response, result.ok ? 200 : result.status, result.ok ? { data: result.data.users?.[0] } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Token Google không hợp lệ' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/otp/send') {
    try {
      const payload = await readBody(request);
      const result = await sendEmailOtp(payload.email);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 500, { message: 'Không thể gửi OTP. Vui lòng thử lại sau.' });
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

    if (!idToken) {
      sendJson(response, 401, { message: 'Thiếu token đăng nhập' });
      return;
    }

    const result = await lookupAccount(idToken);
    sendJson(response, result.ok ? 200 : result.status, result.ok ? { data: result.data.users?.[0] } : result.data);
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
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic.services || [] } : result.ok ? { message: 'Khong tim thay phong kham.' } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && url.pathname.endsWith('/specialties')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '').replace('/specialties', '')).trim();
    const result = await getCatalog();
    const clinic = result.ok ? (result.data.clinics || []).find((item) => item.id === clinicId) : null;
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic.specialties || [] } : result.ok ? { message: 'Khong tim thay phong kham.' } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/clinics/') && !url.pathname.endsWith('/slots')) {
    const clinicId = decodeURIComponent(url.pathname.replace('/api/clinics/', '')).trim();
    const result = await getCatalog();
    const clinic = result.ok ? (result.data.clinics || []).find((item) => item.id === clinicId) : null;
    sendJson(response, result.ok && clinic ? 200 : result.ok ? 404 : result.status, result.ok && clinic ? { data: clinic } : result.ok ? { message: 'Khong tim thay phong kham.' } : result.data);
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
      sendJson(response, 401, { message: 'Ban can dang nhap de xem ho so benh nhan.' });
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
        sendJson(response, 401, { message: 'Ban can dang nhap de luu ho so benh nhan.' });
        return;
      }

      const payload = await readBody(request);
      const result = await saveMedicalProfile(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Du lieu ho so benh nhan khong hop le.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/patient/profiles/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        sendJson(response, 401, { message: 'Ban can dang nhap de cap nhat ho so benh nhan.' });
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
      sendJson(response, 400, { message: 'Du lieu ho so benh nhan khong hop le.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/appointments') {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Ban can dang nhap de xem lich kham.' });
      return;
    }

    const result = await listAppointments(user);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/appointments') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequest(request);
      const result = await createAppointment(user, payload);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Du lieu dat lich khong hop le.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/create-order') {
    try {
      const payload = await readBody(request);
      const user = await getUserFromRequest(request);
      const result = await createPayPalOrder(user, payload.appointmentId);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Du lieu thanh toan khong hop le.' });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/return') {
    const orderId = url.searchParams.get('token');
    const result = orderId
      ? await capturePayPalOrder(orderId)
      : { ok: false, status: 400, data: { message: 'Thieu ma don hang PayPal.' } };
    const redirectUrl = `${config.frontendUrl}?paypalStatus=${result.ok ? 'success' : 'failed'}`;
    response.writeHead(302, { Location: redirectUrl });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/paypal/cancel') {
    response.writeHead(302, { Location: `${config.frontendUrl}?paypalStatus=cancelled` });
    response.end();
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/paypal/webhook') {
    try {
      const payload = await readBody(request);
      const result = await handlePayPalWebhook(payload, request.headers);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    } catch {
      sendJson(response, 400, { message: 'Webhook PayPal khong hop le.' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.endsWith('/cancel') && url.pathname.startsWith('/api/appointments/')) {
    const user = await getUserFromRequest(request);
    if (!user) {
      sendJson(response, 401, { message: 'Ban can dang nhap de huy lich kham.' });
      return;
    }

    const appointmentId = decodeURIComponent(url.pathname.replace('/api/appointments/', '').replace('/cancel', '')).trim();
    const result = await cancelAppointment(user, appointmentId);
    sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/queue') {
    sendJson(response, 200, { data: tickets });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/queue/')) {
    const ticketCode = normalizeTicket(url.pathname.replace('/api/queue/', ''));
    const ticket = tickets.find((item) => item.ticket === ticketCode);
    sendJson(response, ticket ? 200 : 404, ticket ? { data: ticket } : { message: 'Không tìm thấy số khám' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/queue') {
    try {
      const payload = await readBody(request);
    const user = await getUserFromRequest(request);
    const ticket = createTicket({ ...payload, ownerId: user?.localId });
      sendJson(response, 201, { data: ticket });
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu gửi lên không hợp lệ' });
    }
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/queue/')) {
    try {
      const ticketCode = normalizeTicket(url.pathname.replace('/api/queue/', ''));
      const payload = await readBody(request);
      const ticketIndex = tickets.findIndex((item) => item.ticket === ticketCode);

      if (ticketIndex === -1) {
        sendJson(response, 404, { message: 'Không tìm thấy số khám' });
        return;
      }

      tickets = tickets.map((ticket, index) => (
        index === ticketIndex ? { ...ticket, ...payload, ticket: ticket.ticket } : ticket
      ));
      sendJson(response, 200, { data: tickets[ticketIndex] });
    } catch {
      sendJson(response, 400, { message: 'Dữ liệu gửi lên không hợp lệ' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Endpoint không tồn tại' });
});

server.listen(config.port, () => {
  console.log(`MidHealth backend listening on http://localhost:${config.port}`);
});
