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

function readUrl(input) {
  const rawUrl = typeof input === 'string' ? input : input?.url || '';
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl, window.location.origin);
  } catch {
    return NO_FALLBACK;
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

function shouldUseSilentFallback(url, input, init) {
  if (!url || !url.pathname.startsWith('/api/') || !isReadRequest(init) || hasAuthorization(input, init)) {
    return null;
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
