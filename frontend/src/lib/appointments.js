import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './firebase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const patientPortalAccessCache = new Map();

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

async function canUsePatientPortal(user) {
  const token = await getAuthToken(user);
  if (!token) return false;

  const cacheKey = String(firebaseAuth.currentUser?.uid || user?.uid || user?.email || token).trim();
  if (patientPortalAccessCache.has(cacheKey)) return patientPortalAccessCache.get(cacheKey);

  const accessCheck = fetch(`${apiBaseUrl}/api/auth/me?portal=patient&allowIncomplete=1&optional=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    return response.ok && result.data?.allowed !== false;
  }).catch(() => false);
  patientPortalAccessCache.set(cacheKey, accessCheck);
  return accessCheck;
}

async function parseResponse(response, fallbackMessage) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || fallbackMessage);
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
  const idToken = await getAuthToken(user, { forceRefresh: true });
  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ ...stripLocalIds(payload), idToken }),
  });
  return parseResponse(response, 'Không thể đặt lịch khám.');
}

export async function createPayPalOrder(user, appointmentId) {
  if (!appointmentId) {
    throw new Error('Không tìm thấy mã lịch khám để tạo thanh toán PayPal.');
  }
  const idToken = await getAuthToken(user, { forceRefresh: true });
  const response = await fetch(`${apiBaseUrl}/api/payments/paypal/create-order`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ appointmentId, idToken }),
  });
  return parseResponse(response, 'Không thể tạo thanh toán PayPal.');
}

export async function createMoMoAtmPayment(user, appointmentId) {
  if (!appointmentId) {
    throw new Error('Không tìm thấy mã lịch khám để tạo thanh toán MoMo.');
  }
  const idToken = await getAuthToken(user, { forceRefresh: true });
  const response = await fetch(`${apiBaseUrl}/api/payments/momo/create-atm-payment`, {
    method: 'POST',
    headers: await getAuthHeaders(user, { forceRefresh: true }),
    body: JSON.stringify({ appointmentId, idToken }),
  });
  return parseResponse(response, 'Khong the tao thanh toan MoMo ATM.');
}

export async function listDoctorSlots(doctorId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/doctors/${encodeURIComponent(doctorId)}/slots${query}`);
  return parseResponse(response, 'Không thể tải khung giờ khám.');
}

export async function listHospitalSlots(hospitalId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  if (options.serviceName) params.set('serviceName', options.serviceName);
  if (options.specialtyName) params.set('specialtyName', options.specialtyName);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/hospitals/${encodeURIComponent(hospitalId)}/slots${query}`);
  return parseResponse(response, 'Không thể tải lịch khám bệnh viện.');
}

export async function listClinicSlots(clinicId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  if (options.serviceName) params.set('serviceName', options.serviceName);
  if (options.specialtyName) params.set('specialtyName', options.specialtyName);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/clinics/${encodeURIComponent(clinicId)}/slots${query}`);
  return parseResponse(response, 'Không thể tải lịch khám phòng khám.');
}

export async function listPatientProfiles(user) {
  if (!await canUsePatientPortal(user)) return [];

  const response = await fetch(`${apiBaseUrl}/api/patient/profiles`, {
    headers: await getAuthHeaders(user),
  });
  return parseResponse(response, 'Không thể tải hồ sơ bệnh nhân.');
}

export async function listAppointments(user) {
  if (!await canUsePatientPortal(user)) return [];

  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    headers: await getAuthHeaders(user),
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
