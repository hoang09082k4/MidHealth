import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './firebase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

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

async function getAuthHeaders(user, options = {}) {
  const authUser = user || await waitForCurrentUser();
  const token = authUser ? await authUser.getIdToken(Boolean(options.forceRefresh)) : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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
  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(stripLocalIds(payload)),
  });
  return parseResponse(response, 'Khong the dat lich kham.');
}

export async function createPayPalOrder(user, appointmentId) {
  const response = await fetch(`${apiBaseUrl}/api/payments/paypal/create-order`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ appointmentId }),
  });
  return parseResponse(response, 'Khong the tao thanh toan PayPal.');
}

export async function listDoctorSlots(doctorId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/doctors/${encodeURIComponent(doctorId)}/slots${query}`);
  return parseResponse(response, 'Khong the tai khung gio kham.');
}

export async function listHospitalSlots(hospitalId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  if (options.serviceName) params.set('serviceName', options.serviceName);
  if (options.specialtyName) params.set('specialtyName', options.specialtyName);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/hospitals/${encodeURIComponent(hospitalId)}/slots${query}`);
  return parseResponse(response, 'Khong the tai lich kham benh vien.');
}

export async function listClinicSlots(clinicId, options = {}) {
  const params = new URLSearchParams();
  if (options.fromDate) params.set('from', options.fromDate);
  if (options.days) params.set('days', String(options.days));
  if (options.serviceName) params.set('serviceName', options.serviceName);
  if (options.specialtyName) params.set('specialtyName', options.specialtyName);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/api/clinics/${encodeURIComponent(clinicId)}/slots${query}`);
  return parseResponse(response, 'Khong the tai lich kham phong kham.');
}

export async function listPatientProfiles(user) {
  const response = await fetch(`${apiBaseUrl}/api/patient/profiles`, {
    headers: await getAuthHeaders(user),
  });
  return parseResponse(response, 'Khong the tai ho so benh nhan.');
}

export async function listAppointments(user) {
  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    headers: await getAuthHeaders(user),
  });
  return parseResponse(response, 'Khong the tai lich kham.');
}

export async function cancelAppointment(user, appointmentId) {
  const response = await fetch(`${apiBaseUrl}/api/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
  });
  return parseResponse(response, 'Khong the huy lich kham.');
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
  return parseResponse(response, 'Khong the luu ho so benh nhan.');
}
