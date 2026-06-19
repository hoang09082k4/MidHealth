const EMPTY_ARRAY_ENDPOINTS = new Set([
  '/api/appointments',
  '/api/patient/profiles',
]);

const EMPTY_PROVIDER_ENDPOINTS = new Set([
  '/api/provider/workspace',
]);

const EMPTY_PROVIDER_OPERATIONS_ENDPOINTS = new Set([
  '/api/provider/workspace/operations',
]);

const NO_FALLBACK = Symbol('NO_FALLBACK');
const PUBLIC_APPOINTMENT_PATHS = new Set([
  '/',
  '/danh-cho-bac-si',
]);

function readUrl(input) {
  const rawUrl = typeof input === 'string' ? input : input?.url || '';
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }
}

function hasAuthorization(input, init = {}) {
  const headers = new Headers(init.headers || input?.headers || {});
  return Boolean(headers.get('Authorization'));
}

function jsonResponse(data) {
  return Promise.resolve(new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }));
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

function isReadRequest(init = {}) {
  return String(init.method || 'GET').toUpperCase() === 'GET';
}

function isPublicAppointmentRead(url) {
  if (url.pathname !== '/api/appointments') return false;
  return PUBLIC_APPOINTMENT_PATHS.has(window.location.pathname.replace(/\/+$/, '') || '/');
}

function isPublicProviderSessionCheck(url) {
  if (url.pathname !== '/api/auth/me' || url.searchParams.get('optional') !== '1') return false;
  if (url.searchParams.get('portal') !== 'provider') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/danh-cho-bac-si';
}

function shouldUseSilentFallback(url, input, init) {
  if (!url || !url.pathname.startsWith('/api/') || !isReadRequest(init)) {
    return NO_FALLBACK;
  }

  if (hasAuthorization(input, init)) {
    if (isPublicAppointmentRead(url)) return [];
    if (isPublicProviderSessionCheck(url)) return { allowed: false, reason: 'PUBLIC_LANDING' };
    return NO_FALLBACK;
  }

  if (EMPTY_ARRAY_ENDPOINTS.has(url.pathname)) return [];
  if (EMPTY_PROVIDER_ENDPOINTS.has(url.pathname)) return null;
  if (EMPTY_PROVIDER_OPERATIONS_ENDPOINTS.has(url.pathname)) return emptyProviderOperations('Chua dang nhap workspace.');
  if (url.pathname === '/api/auth/me' && url.searchParams.get('optional') === '1') {
    return { allowed: false, reason: 'MISSING_TOKEN' };
  }

  return NO_FALLBACK;
}

export function installSafeApiFetch() {
  if (typeof window === 'undefined' || window.__midhealthSafeApiFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const fallbackData = shouldUseSilentFallback(readUrl(input), input, init);
    if (fallbackData !== NO_FALLBACK) return jsonResponse(fallbackData);
    return nativeFetch(input, init);
  };
  window.__midhealthSafeApiFetchInstalled = true;
}
