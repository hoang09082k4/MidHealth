import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config.js';
import {
  hasFirebaseConfig,
  loginWithEmail,
  lookupAccount,
  registerWithEmail,
} from './firebase_auth.js';
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
