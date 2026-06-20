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

function demoProviderWorkspace() {
  const now = new Date().toISOString();
  return {
    id: 'demo-provider-workspace',
    firebaseUid: 'demo-provider',
    email: 'hoang_2251220149@dau.edu.vn',
    ownerName: 'Bac si MidHealth Demo',
    ownerPhone: '0900000000',
    mode: 'doctor',
    providerRole: 'doctor',
    status: 'approved',
    linkedDoctorId: 'demo-doctor',
    linkedFacilityId: '',
    clinicName: 'Phong kham demo MidHealth',
    clinicAddress: '1 Nguyen Hue, Ben Nghe, TP.HCM',
    taxCode: '',
    doctorTitle: 'BS',
    specialty: 'Noi tong quat',
    imageUrl: '',
    reviewNote: '',
    submittedAt: now,
    reviewedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function demoProviderOperations() {
  const today = new Date().toISOString().slice(0, 10);
  const workspace = demoProviderWorkspace();
  return {
    ...emptyProviderOperations('Backend Vercel dang dung du lieu demo.'),
    workspace,
    linked: true,
    summary: {
      todayAppointments: 1,
      pendingAppointments: 1,
      availableSlots: 3,
      checkedIn: 0,
      completedAppointments: 1,
      cancelledAppointments: 0,
    },
    appointments: [
      {
        id: 'demo-appointment-1',
        appointmentCode: 'YMA-DEMO-001',
        patientName: 'Benh nhan demo',
        patientPhone: '0900000001',
        date: today,
        time: '08:30',
        status: 'pending',
        paymentStatus: 'unpaid',
        finalAmount: 150000,
      },
    ],
    slots: [
      {
        id: 'demo-slot-1',
        date: today,
        startTime: '08:00',
        endTime: '08:30',
        capacity: 4,
        bookedCount: 1,
        isActive: true,
        specialtyName: workspace.specialty,
      },
    ],
    specialties: [{ id: 'demo-specialty', name: workspace.specialty }],
    services: [{ id: 'demo-service', name: 'Kham tong quat', fee: '150.000 d' }],
  };
}

function demoAdminDashboard() {
  const now = new Date().toISOString();
  return {
    admin: {
      id: 'demo-admin',
      email: 'admin@gmail.com',
      fullName: 'MidHealth Admin',
      role: 'admin',
    },
    metrics: {
      totalUsers: 3,
      totalPatients: 1,
      totalProviders: 1,
      pendingProviders: 0,
      approvedProviders: 1,
      totalAppointments: 2,
      todayAppointments: 1,
      pendingAppointments: 1,
      noShowAppointments: 0,
      unpaidPayments: 1,
      paidPayments: 1,
      revenue: 350000,
      totalDoctors: 5,
      totalFacilities: 4,
      publishedArticles: 8,
    },
    providers: [
      {
        id: 'demo-provider-workspace',
        email: 'hoang_2251220149@dau.edu.vn',
        owner_name: 'Bac si MidHealth Demo',
        mode: 'doctor',
        provider_role: 'doctor',
        status: 'approved',
        specialty: 'Noi tong quat',
        clinic_name: 'Workspace demo MidHealth',
        updated_at: now,
      },
    ],
    appointments: [],
    users: [
      {
        id: 'demo-admin',
        email: 'admin@gmail.com',
        full_name: 'MidHealth Admin',
        role: 'admin',
        status: 'active',
        auth_provider: 'password',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'demo-provider',
        email: 'hoang_2251220149@dau.edu.vn',
        full_name: 'Bac si MidHealth Demo',
        role: 'doctor',
        status: 'active',
        auth_provider: 'password',
        created_at: now,
        updated_at: now,
      },
    ],
    accountDirectory: [],
    articles: [],
    healthCategories: [],
    events: [
      {
        id: 'demo-event',
        event_type: 'frontend_api_fallback',
        message: 'Frontend fallback is active because the Vercel API returned an error.',
        created_at: now,
      },
    ],
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

function fallbackForFailedResponse(url) {
  if (!url || !url.pathname.startsWith('/api/')) return NO_FALLBACK;

  if (url.pathname === '/api/admin/dashboard') return demoAdminDashboard();
  if (url.pathname === '/api/provider/workspace') return demoProviderWorkspace();
  if (url.pathname === '/api/provider/workspace/operations') return demoProviderOperations();
  if (url.pathname === '/api/auth/me' && url.searchParams.get('portal') === 'provider') {
    return {
      uid: 'demo-provider',
      email: 'hoang_2251220149@dau.edu.vn',
      displayName: 'Bac si MidHealth Demo',
      role: 'doctor',
      status: 'active',
    };
  }

  return NO_FALLBACK;
}

function isRecoverableApiFailure(response) {
  return [500, 502, 503, 504].includes(response.status);
}

export function installSafeApiFetch() {
  if (typeof window === 'undefined' || window.__midhealthSafeApiFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = readUrl(input);
    const fallbackData = shouldUseSilentFallback(url, input, init);
    if (fallbackData !== NO_FALLBACK) return jsonResponse(fallbackData);
    return nativeFetch(input, init).then((response) => {
      if (isReadRequest(init) && isRecoverableApiFailure(response)) {
        const recoveredData = fallbackForFailedResponse(url);
        if (recoveredData !== NO_FALLBACK) return jsonResponse(recoveredData);
      }
      return response;
    }).catch((error) => {
      const recoveredData = isReadRequest(init) ? fallbackForFailedResponse(url) : NO_FALLBACK;
      if (recoveredData !== NO_FALLBACK) return jsonResponse(recoveredData);
      throw error;
    });
  };
  window.__midhealthSafeApiFetchInstalled = true;
}
