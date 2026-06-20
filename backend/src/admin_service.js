import { hasSupabaseConfig, supabase } from './supabase.js';
import { syncCatalogManagedAccounts } from './catalog_account_service.js';
import { logProviderWorkspaceEvent, reviewProviderWorkspace } from './provider_workspace_service.js';
import { APP_ROLES, requireRoles } from './authorization_service.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function todayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

const bootstrapAdminEmails = new Set(
  (process.env.ADMIN_EMAILS || 'admin@gmail.com')
    .split(',')
    .map((email) => normalizeKey(email))
    .filter(Boolean),
);

function firebaseUid(firebaseUser = {}) {
  return clean(firebaseUser.localId || firebaseUser.uid);
}

function firebaseEmail(firebaseUser = {}) {
  return normalizeKey(firebaseUser.email);
}

function isBootstrapAdmin(firebaseUser = {}) {
  return bootstrapAdminEmails.has(firebaseEmail(firebaseUser));
}

async function ensureBootstrapAdmin(firebaseUser = {}) {
  if (!hasSupabaseConfig || !isBootstrapAdmin(firebaseUser)) return;

  const uid = firebaseUid(firebaseUser);
  const email = firebaseEmail(firebaseUser);
  if (!uid || !email) return;

  const row = {
    firebase_uid: uid,
    email,
    full_name: clean(firebaseUser.displayName) || 'MidHealth Admin',
    avatar_url: clean(firebaseUser.photoUrl || firebaseUser.photoURL) || null,
    role: 'admin',
    status: 'active',
    auth_provider: firebaseUser.providerUserInfo?.[0]?.providerId?.includes('google') ? 'google' : 'password',
    email_verified: Boolean(firebaseUser.emailVerified),
    last_login_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from('app_users')
    .select('id')
    .or(`firebase_uid.eq.${uid},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const result = existing?.id
    ? await supabase.from('app_users').update(row).eq('id', existing.id)
    : await supabase.from('app_users').insert(row);

  if (result.error) throw result.error;
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function articleContent(value = '') {
  const content = String(value || '').trim();
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function uploadArticleImage(dataUrl, articleSlug) {
  if (!dataUrl) return '';
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Ảnh phải có định dạng JPG, PNG hoặc WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Ảnh bài viết không được vượt quá 4 MB.');

  const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const bucket = 'health-articles';
  const filePath = `${articleSlug}-${Date.now()}.${extension}`;
  const { error: lookupError } = await supabase.storage.getBucket(bucket);
  if (lookupError) {
    const { error: bucketError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 4 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (bucketError) throw bucketError;
  }

  const { error } = await supabase.storage.from(bucket).upload(filePath, bytes, {
    contentType: match[1],
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
}

function articleStoragePath(url = '') {
  const marker = '/storage/v1/object/public/health-articles/';
  const index = String(url).indexOf(marker);
  return index === -1 ? '' : decodeURIComponent(String(url).slice(index + marker.length));
}

function mergeAccountRow(base = {}, incoming = {}) {
  return {
    ...base,
    ...incoming,
    sourceTypes: Array.from(new Set([...(base.sourceTypes || []), ...(incoming.sourceTypes || [])])),
    displayName: base.displayName || incoming.displayName || '',
    email: base.email || incoming.email || '',
    role: base.role || incoming.role || '',
    accountStatus: base.accountStatus || incoming.accountStatus || '',
    workspaceStatus: base.workspaceStatus || incoming.workspaceStatus || '',
    catalogStatus: base.catalogStatus || incoming.catalogStatus || '',
    homepageFeatured: incoming.homepageFeatured ?? base.homepageFeatured ?? false,
    homepageOrder: incoming.homepageOrder ?? base.homepageOrder ?? 100,
    specialty: base.specialty || incoming.specialty || '',
    workplace: base.workplace || incoming.workplace || '',
    address: base.address || incoming.address || '',
    phone: base.phone || incoming.phone || '',
    createdAt: base.createdAt || incoming.createdAt || '',
    updatedAt: [base.updatedAt, incoming.updatedAt].filter(Boolean).sort().at(-1) || '',
    hasLoginAccount: Boolean(base.hasLoginAccount || incoming.hasLoginAccount),
    hasWorkspace: Boolean(base.hasWorkspace || incoming.hasWorkspace),
    hasCatalog: Boolean(base.hasCatalog || incoming.hasCatalog),
  };
}

function buildAccountDirectory({ users = [], providers = [], doctors = [], facilities = [] }) {
  const rows = new Map();
  const aliases = new Map();

  function resolveKey(keys) {
    return keys.map((key) => aliases.get(key)).find(Boolean) || keys[0];
  }

  function put(keys, incoming) {
    const cleanKeys = keys.filter(Boolean);
    const key = resolveKey(cleanKeys);
    const merged = mergeAccountRow(rows.get(key), {
      id: key,
      ...incoming,
      linkedKeys: Array.from(new Set([...(rows.get(key)?.linkedKeys || []), ...cleanKeys])),
    });
    rows.set(key, merged);
    cleanKeys.forEach((alias) => aliases.set(alias, key));
  }

  users.forEach((user) => {
    const keys = [
      `user:${user.id}`,
      user.email ? `email:${normalizeKey(user.email)}` : '',
    ];
    put(keys, {
      sourceTypes: ['account'],
      userId: user.id,
      displayName: user.full_name || user.email,
      email: user.email,
      role: user.role,
      kind: ['clinic', 'hospital', 'doctor'].includes(user.role) ? user.role : user.role,
      accountStatus: user.status,
      authProvider: user.auth_provider,
      createdAt: user.created_at,
      updatedAt: user.updated_at || user.created_at,
      hasLoginAccount: true,
    });
  });

  providers.forEach((provider) => {
    const isFacility = ['clinic', 'hospital'].includes(provider.mode);
    const keys = [
      `workspace:${provider.id}`,
      provider.app_user_id ? `user:${provider.app_user_id}` : '',
      provider.linked_doctor_id ? `doctor:${provider.linked_doctor_id}` : '',
      provider.linked_facility_id ? `facility:${provider.linked_facility_id}` : '',
      provider.email ? `email:${normalizeKey(provider.email)}` : '',
    ];
    put(keys, {
      sourceTypes: ['workspace'],
      workspaceId: provider.id,
      userId: provider.app_user_id || '',
      doctorId: provider.linked_doctor_id || '',
      facilityId: provider.linked_facility_id || '',
      displayName: isFacility ? provider.clinic_name : provider.owner_name,
      email: provider.email,
      role: provider.provider_role || provider.mode,
      kind: provider.mode,
      workspaceStatus: provider.status,
      specialty: provider.specialty || '',
      workplace: provider.clinic_name || '',
      address: provider.clinic_address || '',
      phone: provider.owner_phone || '',
      createdAt: provider.created_at,
      updatedAt: provider.updated_at || provider.created_at,
      hasWorkspace: true,
    });
  });

  doctors.forEach((doctor) => {
    const keys = [
      `doctor:${doctor.id}`,
      doctor.full_name ? `doctor-name:${normalizeKey(doctor.full_name)}` : '',
    ];
    put(keys, {
      sourceTypes: ['catalog_doctor'],
      doctorId: doctor.id,
      displayName: doctor.full_name,
      role: 'doctor',
      kind: 'doctor',
      catalogStatus: doctor.is_active ? 'active' : 'disabled',
      homepageFeatured: doctor.homepage_featured !== false,
      homepageOrder: Number(doctor.homepage_order ?? 100),
      specialty: doctor.clinic_specialties?.name || '',
      workplace: doctor.medical_facilities?.name || doctor.workplace_text || '',
      address: doctor.medical_facilities?.address || '',
      createdAt: doctor.created_at,
      updatedAt: doctor.updated_at || doctor.created_at,
      hasCatalog: true,
    });
  });

  facilities.forEach((facility) => {
    const keys = [
      `facility:${facility.id}`,
      facility.name ? `facility-name:${normalizeKey(facility.name)}` : '',
    ];
    put(keys, {
      sourceTypes: ['catalog_facility'],
      facilityId: facility.id,
      displayName: facility.name,
      role: facility.type,
      kind: facility.type,
      catalogStatus: facility.is_active ? 'active' : 'disabled',
      homepageFeatured: facility.homepage_featured !== false,
      homepageOrder: Number(facility.homepage_order ?? 100),
      workplace: facility.subtitle || '',
      address: facility.address || '',
      phone: facility.phone || facility.hotline || '',
      createdAt: facility.created_at,
      updatedAt: facility.updated_at || facility.created_at,
      hasCatalog: true,
    });
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      sourceLabel: [
        row.hasLoginAccount ? (row.authProvider === 'catalog' ? 'Tài khoản catalog' : 'Tài khoản') : '',
        row.hasWorkspace ? 'Workspace' : '',
        row.hasCatalog ? 'Catalog' : '',
      ].filter(Boolean).join(' + '),
      needsLinking: row.hasCatalog
        && ['doctor', 'clinic', 'hospital'].includes(row.kind)
        && !row.hasLoginAccount
        && !row.hasWorkspace,
      duplicateResolved: (row.linkedKeys || []).length > 1,
    }))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function countRows(table, queryBuilder = null) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (queryBuilder) query = queryBuilder(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function fetchAdminAccount(firebaseUser) {
  await ensureBootstrapAdmin(firebaseUser);
  return requireRoles(firebaseUser, APP_ROLES.ADMIN, {
    message: 'Tài khoản không có quyền admin.',
  });
}

export async function requireAdmin(firebaseUser) {
  return fetchAdminAccount(firebaseUser);
}

function demoAdminDashboard(firebaseUser = {}, admin = {}) {
  const now = new Date().toISOString();
  return {
    admin: {
      id: admin.data?.id || 'demo-admin',
      email: admin.data?.email || firebaseUser.email || 'admin@gmail.com',
      fullName: admin.data?.full_name || firebaseUser.displayName || 'MidHealth Admin',
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
        email: admin.data?.email || 'admin@gmail.com',
        full_name: admin.data?.full_name || 'MidHealth Admin',
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
        event_type: 'demo_mode_enabled',
        message: 'Vercel dang chay che do demo vi chua cau hinh Supabase.',
        created_at: now,
      },
    ],
  };
}

export async function getAdminDashboard(firebaseUser) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  if (!hasSupabaseConfig) {
    return { ok: true, status: 200, data: demoAdminDashboard(firebaseUser, admin) };
  }

  try {
    const today = todayDateValue();
    const [
      totalUsers,
      totalPatients,
      totalProviders,
      pendingProviders,
      approvedProviders,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      noShowAppointments,
      unpaidPayments,
      paidPayments,
      totalDoctors,
      totalFacilities,
      publishedArticles,
    ] = await Promise.all([
      countRows('app_users'),
      countRows('patient_profiles'),
      countRows('provider_workspaces'),
      countRows('provider_workspaces', (query) => query.eq('status', 'pending_review')),
      countRows('provider_workspaces', (query) => query.eq('status', 'approved')),
      countRows('appointments'),
      countRows('appointments', (query) => query.eq('appointment_date', today)),
      countRows('appointments', (query) => query.eq('status', 'pending')),
      countRows('appointments', (query) => query.eq('status', 'no_show')),
      countRows('payments', (query) => query.neq('status', 'paid')),
      countRows('payments', (query) => query.eq('status', 'paid')),
      countRows('doctors'),
      countRows('medical_facilities'),
      countRows('health_articles', (query) => query.eq('status', 'published')),
    ]);

    const { data: revenueRows, error: revenueError } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid');
    if (revenueError) throw revenueError;

    const { data: providerRows, error: providerError } = await supabase
      .from('provider_workspaces')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(300);
    if (providerError) throw providerError;

    const { data: appointmentRows, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time_text, patient_name, patient_phone, status, payment_status, final_amount, doctors(full_name), medical_facilities(name)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (appointmentError) throw appointmentError;

    const { data: userRows, error: userError } = await supabase
      .from('app_users')
      .select('id, email, full_name, role, status, auth_provider, last_login_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (userError) throw userError;

    const { data: doctorRows, error: doctorError } = await supabase
      .from('doctors')
      .select('id, full_name, specialty_id, facility_id, workplace_text, is_active, homepage_featured, homepage_order, created_at, updated_at, clinic_specialties(name), medical_facilities(name, address)')
      .order('updated_at', { ascending: false })
      .limit(300);
    if (doctorError) throw doctorError;

    const { data: facilityRows, error: facilityError } = await supabase
      .from('medical_facilities')
      .select('id, type, name, subtitle, address, phone, hotline, is_active, homepage_featured, homepage_order, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(300);
    if (facilityError) throw facilityError;

    const { data: articleRows, error: articleError } = await supabase
      .from('health_articles')
      .select('id, category_id, title, slug, summary, content, thumbnail_url, status, is_featured, published_at, updated_at, view_count, category:health_categories(id, name, slug)')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (articleError) throw articleError;

    const { data: healthCategoryRows, error: healthCategoryError } = await supabase
      .from('health_categories')
      .select('id, name, slug, status')
      .eq('status', 'active')
      .order('name');
    if (healthCategoryError) throw healthCategoryError;

    const { data: eventRows, error: eventError } = await supabase
      .from('provider_workspace_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    const events = eventError ? [] : (eventRows || []);

    const revenue = (revenueRows || []).reduce((total, row) => total + Number(row.amount || 0), 0);

    return {
      ok: true,
      status: 200,
      data: {
        admin: {
          id: admin.data.id,
          email: admin.data.email,
          fullName: admin.data.full_name,
          role: admin.data.role,
        },
        metrics: {
          totalUsers,
          totalPatients,
          totalProviders,
          pendingProviders,
          approvedProviders,
          totalAppointments,
          todayAppointments,
          pendingAppointments,
          noShowAppointments,
          unpaidPayments,
          paidPayments,
          revenue,
          totalDoctors,
          totalFacilities,
          publishedArticles,
        },
        providers: providerRows || [],
        appointments: appointmentRows || [],
        users: userRows || [],
        accountDirectory: buildAccountDirectory({
          users: userRows || [],
          providers: providerRows || [],
          doctors: doctorRows || [],
          facilities: facilityRows || [],
        }),
        articles: articleRows || [],
        healthCategories: healthCategoryRows || [],
        events,
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function saveHealthArticleAsAdmin(firebaseUser, articleId, payload = {}) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const title = clean(payload.title);
  const categoryId = clean(payload.categoryId);
  const summary = clean(payload.summary);
  const content = articleContent(payload.content);
  const status = ['draft', 'published', 'archived'].includes(payload.status) ? payload.status : 'draft';
  if (!title || !categoryId || !content) {
    return { ok: false, status: 400, data: { message: 'Tiêu đề, chuyên mục và nội dung là bắt buộc.' } };
  }

  try {
    let slug = slugify(payload.slug || title);
    if (!slug) slug = `bai-viet-${Date.now()}`;
    const duplicateQuery = supabase.from('health_articles').select('id').eq('slug', slug).limit(1);
    const { data: duplicateRows, error: duplicateError } = articleId
      ? await duplicateQuery.neq('id', articleId)
      : await duplicateQuery;
    if (duplicateError) throw duplicateError;
    if (duplicateRows?.length) slug = `${slug}-${Date.now().toString().slice(-6)}`;

    const uploadedUrl = await uploadArticleImage(payload.imageDataUrl, slug);
    const row = {
      category_id: categoryId,
      title,
      slug,
      summary: summary || null,
      content,
      thumbnail_url: uploadedUrl || clean(payload.thumbnailUrl) || '',
      status,
      is_featured: Boolean(payload.isFeatured),
      published_at: payload.publishedAt || new Date().toISOString(),
      published_date: payload.publishedAt || new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };

    const query = articleId
      ? supabase.from('health_articles').update(row).eq('id', articleId)
      : supabase.from('health_articles').insert(row);
    const { data, error } = await query.select('*, category:health_categories(id, name, slug)').single();
    if (error) throw error;

    await logProviderWorkspaceEvent({
      actor: firebaseUser,
      actorRole: 'admin',
      eventType: articleId ? 'health_article_updated' : 'health_article_created',
      entityType: 'health_article',
      entityId: data.id,
      message: articleId ? 'Admin updated a health article.' : 'Admin created a health article.',
      metadata: { title, status, slug },
    });
    return { ok: true, status: articleId ? 200 : 201, data };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function deleteHealthArticleAsAdmin(firebaseUser, articleId) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const { data: article, error: findError } = await supabase
    .from('health_articles')
    .select('id, thumbnail_url')
    .eq('id', articleId)
    .maybeSingle();
  if (findError) return { ok: false, status: 500, data: { message: findError.message } };
  if (!article) return { ok: false, status: 404, data: { message: 'Không tìm thấy bài viết.' } };

  const { error } = await supabase.from('health_articles').delete().eq('id', articleId);
  if (error) return { ok: false, status: 500, data: { message: error.message } };
  const storagePath = articleStoragePath(article.thumbnail_url);
  if (storagePath) await supabase.storage.from('health-articles').remove([storagePath]);
  return { ok: true, status: 200, data: { id: articleId } };
}

export async function syncCatalogAccountsAsAdmin(firebaseUser) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  try {
    const result = await syncCatalogManagedAccounts();
    await logProviderWorkspaceEvent({
      actor: firebaseUser,
      actorRole: 'admin',
      eventType: 'catalog_accounts_synced',
      entityType: 'catalog',
      message: 'Admin synchronized catalog-managed accounts.',
      metadata: result,
    });
    return { ok: true, status: 200, data: result };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateCatalogEntityAsAdmin(firebaseUser, payload = {}) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const entityType = clean(payload.entityType);
  const entityId = clean(payload.entityId);
  const active = payload.active;
  const hasActive = typeof active === 'boolean';
  const hasHomepageFeatured = typeof payload.homepageFeatured === 'boolean';
  const homepageOrder = Number(payload.homepageOrder);
  const hasHomepageOrder = payload.homepageOrder !== undefined
    && Number.isInteger(homepageOrder)
    && homepageOrder >= 0;
  if (
    !['doctor', 'facility'].includes(entityType)
    || !entityId
    || (!hasActive && !hasHomepageFeatured && !hasHomepageOrder)
    || (payload.homepageOrder !== undefined && !hasHomepageOrder)
  ) {
    return { ok: false, status: 400, data: { message: 'Dữ liệu cập nhật catalog không hợp lệ.' } };
  }

  const table = entityType === 'doctor' ? 'doctors' : 'medical_facilities';
  const patch = {};
  if (hasActive) patch.is_active = active;
  if (hasHomepageFeatured) patch.homepage_featured = payload.homepageFeatured;
  if (hasHomepageOrder) patch.homepage_order = homepageOrder;
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq('id', entityId)
    .select()
    .single();
  if (error) return { ok: false, status: 500, data: { message: error.message } };

  await logProviderWorkspaceEvent({
    actor: firebaseUser,
    actorRole: 'admin',
    eventType: hasActive
      ? (active ? 'catalog_entity_enabled' : 'catalog_entity_disabled')
      : 'catalog_homepage_priority_updated',
    entityType,
    entityId,
    message: hasActive
      ? (active ? 'Admin enabled catalog entity.' : 'Admin disabled catalog entity.')
      : 'Admin updated homepage catalog priority.',
    metadata: { table, ...patch },
  });

  return { ok: true, status: 200, data };
}

export async function reviewProviderAsAdmin(firebaseUser, workspaceId, payload = {}) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const status = clean(payload.status);
  if (!['approved', 'rejected', 'pending_review'].includes(status)) {
    return { ok: false, status: 400, data: { message: 'Trạng thái duyệt không hợp lệ.' } };
  }

  return reviewProviderWorkspace(workspaceId, {
    status,
    reviewNote: clean(payload.reviewNote),
    actor: firebaseUser,
    actorRole: 'admin',
  });
}

export async function updateUserAsAdmin(firebaseUser, userId, payload = {}) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const { data: targetUser, error: targetError } = await supabase
    .from('app_users')
    .select('id, auth_provider')
    .eq('id', userId)
    .single();
  if (targetError) return { ok: false, status: 500, data: { message: targetError.message } };
  if (targetUser.auth_provider === 'catalog') {
    return {
      ok: false,
      status: 409,
      data: { message: 'Hồ sơ catalog nội bộ không phải tài khoản đăng nhập. Hãy quản lý trạng thái tại Danh mục y tế.' },
    };
  }

  const patch = {};
  if (['patient', 'doctor', 'clinic', 'hospital', 'staff', 'admin'].includes(payload.role)) patch.role = payload.role;
  if (['active', 'disabled', 'pending'].includes(payload.status)) patch.status = payload.status;
  if (!Object.keys(patch).length) {
    return { ok: false, status: 400, data: { message: 'Không có dữ liệu cập nhật hợp lệ.' } };
  }

  const { data, error } = await supabase
    .from('app_users')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) return { ok: false, status: 500, data: { message: error.message } };

  await logProviderWorkspaceEvent({
    actor: firebaseUser,
    actorRole: 'admin',
    eventType: 'user_updated',
    entityType: 'app_user',
    entityId: userId,
    message: 'Admin updated user account.',
    metadata: patch,
  });

  return { ok: true, status: 200, data };
}
