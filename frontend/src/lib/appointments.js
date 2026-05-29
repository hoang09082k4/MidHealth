const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function getAuthHeaders(user) {
  const token = user ? await user.getIdToken() : '';
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

export async function createAppointment(user, payload) {
  const response = await fetch(`${apiBaseUrl}/api/appointments`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return parseResponse(response, 'Khong the dat lich kham.');
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
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ profile }),
  });
  return parseResponse(response, 'Khong the luu ho so benh nhan.');
}
