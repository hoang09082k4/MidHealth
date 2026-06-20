try {
  require.resolve('@supabase/supabase-js');
  require.resolve('nodemailer');
} catch {
  // These calls are build-time hints for Vercel's file tracer.
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
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
        event_type: 'api_entrypoint_fallback',
        message: 'Root API fallback is active on Vercel.',
        created_at: now,
      },
    ],
  };
}

function authFallback(request, response) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url, `https://${request.headers.host || 'midhealth.vercel.app'}`);
  if (url.pathname === '/api/auth/me' && url.searchParams.get('portal') === 'provider') {
    sendJson(response, 200, {
      data: {
        uid: 'demo-provider',
        email: 'hoang_2251220149@dau.edu.vn',
        displayName: 'Bac si MidHealth Demo',
        role: 'doctor',
        status: 'active',
      },
    });
    return true;
  }

  if (url.pathname === '/api/admin/dashboard') {
    sendJson(response, 200, { data: demoAdminDashboard() });
    return true;
  }

  return false;
}

module.exports = async function midhealthApi(request, response) {
  try {
    const { handleRequest } = await import('../backend/src/server.js');
    return handleRequest(request, response);
  } catch (error) {
    if (authFallback(request, response)) return;

    sendJson(response, 503, {
      message: 'Backend function is unavailable on this deployment.',
      detail: error?.message || String(error),
    });
  }
};
