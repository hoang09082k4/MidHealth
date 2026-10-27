import { onAuthStateChanged } from 'firebase/auth';
import { apiBaseUrl } from './api_base';
import { firebaseAuth } from './firebase';

function waitForCurrentUser(timeoutMs = 2500) {
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(firebaseAuth.currentUser);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(currentUser);
    });
  });
}

async function getAuthToken(user, options = {}) {
  let authUser = firebaseAuth.currentUser || user || await waitForCurrentUser();
  if (!authUser?.getIdToken && user !== firebaseAuth.currentUser) {
    authUser = firebaseAuth.currentUser || await waitForCurrentUser();
  }

  let token = '';
  if (authUser?.getIdToken) {
    try {
      token = await authUser.getIdToken(Boolean(options.forceRefresh));
    } catch {
      const currentUser = firebaseAuth.currentUser || await waitForCurrentUser();
      token = currentUser?.getIdToken ? await currentUser.getIdToken(true) : '';
    }
  }
  return token;
}

async function getAuthHeaders(user, options = {}) {
  const token = await getAuthToken(user, options);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function apiUrl(path, params = {}) {
  const url = new URL(path, `${apiBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function parseResponse(response, fallbackMessage) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function stripLocalIds(value) {
  if (Array.isArray(value)) return value.map(stripLocalIds);
  if (!value || typeof value !== 'object') return value;

  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stripLocalIds(item)]));
  if ('id' in next && next.id && !isUuid(next.id)) {
    delete next.id;
  }
  return next;
}

export async function createAppointment(user, payload) {
  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify(stripLocalIds(payload)),
  });
  return parseResponse(response, 'Không thể đặt lịch khám.');
}

export async function createPayPalOrder(user, appointmentId) {
  if (!appointmentId) {
    throw new Error('Không tìm thấy mã lịch khám để tạo thanh toán PayPal.');
  }
  const response = await fetch(`${apiBaseUrl}/api/payments/paypal/create-order`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ appointmentId }),
  });
  return parseResponse(response, 'Không thể tạo thanh toán PayPal.');
}

export async function listDoctorSlots(doctorId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/doctors/${encodeURIComponent(doctorId)}/slots${query}`);
  return parseResponse(response, 'Không thể tải khung giờ khám.');
}

export async function rescheduleAppointment(user, appointmentId, slotId) {
  const response = await fetch(`${apiBaseUrl}/api/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ slotId }),
  });
  return parseResponse(response, 'Không thể đổi lịch khám.');
}

export async function listPatientProfiles(user) {
  const token = await getAuthToken(user);
  if (!token) throw new Error('Vui lòng đăng nhập để xem hồ sơ bệnh nhân.');

  const response = await fetch(apiUrl('/api/patient/profiles'), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return parseResponse(response, 'Không thể tải hồ sơ bệnh nhân.');
}

export async function listAppointments(user) {
  const token = await getAuthToken(user);
  if (!token) throw new Error('Vui lòng đăng nhập để xem lịch khám.');

  const response = await fetch(apiUrl('/api/appointments'), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return parseResponse(response, 'Không thể tải lịch khám.');
}

export async function cancelAppointment(user, appointmentId) {
  const response = await fetch(`${apiBaseUrl}/api/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
  });
  return parseResponse(response, 'Không thể hủy lịch khám.');
}

export async function savePatientProfile(user, profile) {
  const hasDatabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profile.id || '');
  const method = hasDatabaseId ? 'PATCH' : 'POST';
  const path = hasDatabaseId ? `/api/patient/profiles/${profile.id}` : '/api/patient/profiles';
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ profile: stripLocalIds(profile) }),
  });
  return parseResponse(response, 'Không thể lưu hồ sơ bệnh nhân.');
}

export async function saveRegistrationProfile(user, profile, otpToken = '') {
  const response = await fetch(`${apiBaseUrl}/api/patient/account-profile`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ profile, ...(otpToken ? { otpToken } : {}) }),
  });
  return parseResponse(response, 'Không thể lưu hồ sơ đăng ký.');
}
