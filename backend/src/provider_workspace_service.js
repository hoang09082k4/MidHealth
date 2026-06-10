import { upsertAppUser } from './account_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { APP_ROLES, requireRoles } from './authorization_service.js';

const VALID_MODES = new Set(['doctor', 'clinic']);
const VALID_STATUSES = new Set(['draft', 'pending_review', 'approved', 'rejected']);
const VALID_DOCTOR_TITLES = new Set(['BS', 'BS.CKI', 'BS.CKII', 'ThS.BS', 'TS.BS', 'PGS.TS.BS', 'GS.TS.BS']);
const MODE_TO_APP_ROLE = {
  doctor: 'doctor',
  clinic: 'clinic',
};

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function isDuplicateKeyError(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message || '');
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return clean(email).toLowerCase();
}

function normalizeDoctorTitle(value = '') {
  const normalized = String(value).trim().replace(/\s+/g, '').toUpperCase();
  return {
    BS: 'BS',
    'BS.CK1': 'BS.CKI',
    'BS.CKI': 'BS.CKI',
    'BS.CK2': 'BS.CKII',
    'BS.CKII': 'BS.CKII',
    'THS.BS': 'ThS.BS',
    'TS.BS': 'TS.BS',
    'PGS.TS.BS': 'PGS.TS.BS',
    'GS.TS.BS': 'GS.TS.BS',
  }[normalized] || '';
}

function todayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function futureDateValue(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function toTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}:00`;
}

function addMinutes(time, minutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes, 0);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'midhealth-provider';
}

function initialsFromName(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'MH';
}

function isMissingProviderWorkspaceTable(error) {
  return error?.code === '42P01'
    || /provider_workspaces/i.test(error?.message || '')
    || /relation .* does not exist/i.test(error?.message || '');
}

function isMissingProviderWorkspaceRoleColumn(error) {
  return error?.code === '42703'
    || /provider_role/i.test(error?.message || '')
    || /column .* does not exist/i.test(error?.message || '');
}

function isMissingProviderWorkspaceLinkColumn(error) {
  return error?.code === '42703'
    || /linked_doctor_id/i.test(error?.message || '')
    || /linked_facility_id/i.test(error?.message || '');
}

function missingTableResult() {
  return {
    ok: false,
    status: 500,
    data: {
      message: "Chưa có bảng provider_workspaces trong Supabase. Hãy áp dụng supabase/schema.sql rồi chạy supabase/seed.sql để đồng bộ database.",
    },
  };
}

function mapWorkspaceRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    mode: row.mode,
    providerRole: row.provider_role || row.mode,
    status: row.status,
    linkedDoctorId: row.linked_doctor_id || '',
    linkedFacilityId: row.linked_facility_id || '',
    clinicName: row.clinic_name || '',
    clinicAddress: row.clinic_address || '',
    taxCode: row.tax_code || '',
    doctorTitle: row.doctor_title || '',
    specialty: row.specialty || '',
    imageUrl: row.image_url || '',
    reviewNote: row.review_note || '',
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyOperations(workspace, reason = '') {
  return {
    workspace,
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
    services: [],
    report: [],
    activity: [],
  };
}

function actorFromFirebaseUser(firebaseUser, fallbackRole = '') {
  return {
    actor_firebase_uid: clean(firebaseUser?.localId || firebaseUser?.uid) || null,
    actor_email: normalizeEmail(firebaseUser?.email || '') || null,
    actor_role: fallbackRole || null,
  };
}

export async function logProviderWorkspaceEvent({
  workspaceId = null,
  actor = null,
  actorRole = '',
  eventType,
  entityType,
  entityId = null,
  message,
  metadata = {},
}) {
  if (!hasSupabaseConfig || !eventType || !entityType || !message) return null;

  const actorFields = actor ? actorFromFirebaseUser(actor, actorRole) : { actor_firebase_uid: null, actor_email: null, actor_role: actorRole || null };
  const { data, error } = await supabase
    .from('provider_workspace_events')
    .insert({
      workspace_id: workspaceId || null,
      ...actorFields,
      event_type: eventType,
      entity_type: entityType,
      entity_id: isUuid(entityId) ? entityId : null,
      message,
      metadata,
    })
    .select()
    .single();

  if (error) return null;
  return data;
}

function mapWorkspaceEvent(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id || '',
    actorEmail: row.actor_email || '',
    actorRole: row.actor_role || '',
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id || '',
    message: row.message,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

async function listProviderWorkspaceEvents(workspaceId, limit = 20) {
  if (!workspaceId || !isUuid(workspaceId)) return [];
  const { data, error } = await supabase
    .from('provider_workspace_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map(mapWorkspaceEvent);
}

async function findLinkedDoctor(workspace) {
  if (!workspace || workspace.mode !== 'doctor') return null;

  if (workspace.linkedDoctorId && isUuid(workspace.linkedDoctorId)) {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, full_name, title, specialty_id, facility_id, workplace_text, medical_facilities(name, address)')
      .eq('id', workspace.linkedDoctorId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const ownerName = clean(workspace.ownerName);
  const specialty = clean(workspace.specialty);
  const specialtyRow = specialty ? await findSpecialtyByName(specialty) : null;
  let query = supabase
    .from('doctors')
    .select('id, full_name, title, specialty_id, facility_id, workplace_text, medical_facilities(name, address)')
    .eq('is_active', true)
    .limit(1);

  if (ownerName) {
    query = query.ilike('full_name', `%${ownerName.replace(/^BS\.?\s*/i, '').trim()}%`);
  } else if (specialtyRow?.id) {
    query = query.eq('specialty_id', specialtyRow.id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findSpecialtyByName(name) {
  const specialtyName = clean(name);
  if (!specialtyName) return null;

  const { data, error } = await supabase
    .from('clinic_specialties')
    .select('id, name')
    .ilike('name', specialtyName)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getSpecialtyNameById(specialtyId) {
  if (!isUuid(specialtyId)) return '';

  const { data, error } = await supabase
    .from('clinic_specialties')
    .select('name')
    .eq('id', specialtyId)
    .maybeSingle();
  if (error) return '';
  return data?.name || '';
}

async function findLinkedFacility(workspace) {
  if (!workspace || workspace.mode !== 'clinic') return null;

  if (workspace.linkedFacilityId && isUuid(workspace.linkedFacilityId)) {
    const { data, error } = await supabase
      .from('medical_facilities')
      .select('id, name, address, type')
      .eq('id', workspace.linkedFacilityId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const clinicName = clean(workspace.clinicName);
  if (!clinicName) return null;

  const { data, error } = await supabase
    .from('medical_facilities')
    .select('id, name, address, type')
    .eq('type', 'clinic')
    .ilike('name', `%${clinicName}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findOrCreateSpecialty(name) {
  const specialtyName = clean(name) || 'Khám tổng quát';
  const { data: existing, error: lookupError } = await supabase
    .from('clinic_specialties')
    .select('id, name')
    .ilike('name', specialtyName)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const slugBase = slugify(specialtyName);
  const { data, error } = await supabase
    .from('clinic_specialties')
    .insert({
      slug: `${slugBase}-${Date.now().toString(36)}`,
      name: specialtyName,
      description: `Chuyên khoa được tạo từ hồ sơ đối tác MidHealth: ${specialtyName}.`,
      is_active: true,
    })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

async function syncProviderCatalogLink(workspaceRow) {
  const workspace = mapWorkspaceRow(workspaceRow);
  const active = workspace.status === 'approved';

  if (workspace.mode === 'doctor') {
    const specialty = await findOrCreateSpecialty(workspace.specialty);
    const existingDoctor = workspace.linkedDoctorId ? null : await findLinkedDoctor(workspace);
    const doctorRow = {
      full_name: workspace.ownerName,
      initials: initialsFromName(workspace.ownerName),
      title: workspace.doctorTitle || null,
      specialty_id: specialty.id,
      workplace_text: workspace.clinicName || 'Bác sĩ độc lập trên MidHealth',
      avatar_url: workspace.imageUrl || null,
      intro: `Hồ sơ đối tác MidHealth của ${workspace.ownerName}.`,
      is_active: active,
    };

    const targetDoctorId = workspace.linkedDoctorId || existingDoctor?.id || '';
    const result = targetDoctorId
      ? await supabase
        .from('doctors')
        .update(doctorRow)
        .eq('id', targetDoctorId)
        .select('id')
        .single()
      : await supabase
        .from('doctors')
        .insert({
          ...doctorRow,
          slug: `${slugify(workspace.ownerName)}-${String(workspace.firebaseUid).slice(0, 8)}`,
        })
        .select('id')
        .single();
    if (result.error) throw result.error;

    return { linked_doctor_id: result.data.id, linked_facility_id: null };
  }

  const existingFacility = workspace.linkedFacilityId ? null : await findLinkedFacility(workspace);
  const facilityRow = {
    type: 'clinic',
    name: workspace.clinicName,
    subtitle: 'Phòng khám đối tác MidHealth',
    intro: `Hồ sơ phòng khám đối tác MidHealth: ${workspace.clinicName}.`,
    address: workspace.clinicAddress,
    avatar_url: workspace.imageUrl || null,
    phone: workspace.ownerPhone || null,
    hotline: workspace.ownerPhone || null,
    is_active: active,
  };

  const targetFacilityId = workspace.linkedFacilityId || existingFacility?.id || '';
  const result = targetFacilityId
    ? await supabase
      .from('medical_facilities')
      .update(facilityRow)
      .eq('id', targetFacilityId)
      .select('id')
      .single()
    : await supabase
      .from('medical_facilities')
      .insert({
        ...facilityRow,
        slug: `${slugify(workspace.clinicName)}-${String(workspace.firebaseUid).slice(0, 8)}`,
      })
      .select('id')
      .single();
  if (result.error) throw result.error;

  return { linked_doctor_id: null, linked_facility_id: result.data.id };
}

async function resolveProviderLink(workspace) {
  const linkedDoctor = await findLinkedDoctor(workspace);
  const linkedFacility = await findLinkedFacility(workspace);
  const linkedId = workspace?.mode === 'doctor' ? linkedDoctor?.id : linkedFacility?.id;

  return {
    linkedDoctor,
    linkedFacility,
    linkedId,
    isLinked: Boolean(linkedId),
  };
}

function mapAppointmentForProvider(appointment) {
  const ticket = Array.isArray(appointment.queue_tickets) ? appointment.queue_tickets[0] : appointment.queue_tickets;
  const appointmentDate = appointment.appointment_date;
  const appointmentTime = appointment.appointment_time_text || formatTime(appointment.appointment_time);
  const isUnpaidConfirmed = appointment.payment_status !== 'paid' && appointment.status === 'confirmed';
  const isPendingSoon = appointment.status === 'pending' && appointmentDate <= futureDateValue(1);
  const riskLevel = appointment.status === 'no_show'
    ? 'high'
    : isUnpaidConfirmed || isPendingSoon
      ? 'medium'
      : 'low';
  return {
    id: appointment.id,
    time: appointmentTime,
    date: appointmentDate,
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone || '',
    reason: appointment.reason || appointment.note || 'Chưa có lý do khám',
    status: appointment.status,
    paymentStatus: appointment.payment_status,
    riskLevel,
    riskReason: riskLevel === 'high'
      ? 'Da ghi nhan khong den'
      : isUnpaidConfirmed
        ? 'Da xac nhan nhung chua thanh toan'
        : isPendingSoon
          ? 'Lich sap toi nhung chua xac nhan'
          : 'Rui ro thap',
    insuranceUsed: Boolean(appointment.insurance_used),
    ticketCode: ticket?.ticket_code || '',
    appointmentCode: ticket?.appointment_code || '',
    queueNumber: ticket?.queue_number || null,
    queueStatus: ticket?.status || '',
    serviceName: appointment.facility_services?.name || '',
    specialtyName: appointment.clinic_specialties?.name || '',
    createdAt: appointment.created_at,
  };
}

function mapSlotForProvider(slot) {
  return {
    id: slot.id,
    date: slot.slot_date,
    startTime: formatTime(slot.start_time),
    endTime: formatTime(slot.end_time),
    capacity: slot.capacity,
    bookedCount: slot.booked_count,
    availableCount: Math.max((slot.capacity || 0) - (slot.booked_count || 0), 0),
    isActive: Boolean(slot.is_active),
    session: formatTime(slot.start_time) < '12:00' ? 'morning' : formatTime(slot.start_time) < '17:30' ? 'afternoon' : 'evening',
  };
}

function validateWorkspacePayload(payload = {}) {
  const mode = clean(payload.mode);
  if (!VALID_MODES.has(mode)) {
    return 'Vui lòng chọn Có phòng khám hoặc Không có phòng khám.';
  }

  if (mode === 'clinic') {
    if (!clean(payload.clinicName)) return 'Vui lòng nhập tên phòng khám.';
    if (!clean(payload.clinicAddress)) return 'Vui lòng nhập địa chỉ phòng khám.';
  }

  if (mode === 'doctor') {
    if (!VALID_DOCTOR_TITLES.has(normalizeDoctorTitle(payload.doctorTitle))) {
      return 'Vui lòng chọn danh xưng chuyên môn hợp lệ.';
    }
    if (!clean(payload.specialty)) {
      return 'Vui lòng chọn chuyên khoa chính của bác sĩ.';
    }
  }

  return '';
}

export async function ensureProviderWorkspaceTableReady() {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 500, data: { message: 'Backend chưa cấu hình Supabase để lưu hồ sơ đối tác.' } };
  }

  const { error } = await supabase
    .from('provider_workspaces')
    .select('id,provider_role,linked_doctor_id,linked_facility_id')
    .limit(1);

  if (!error) return { ok: true };
  if (isMissingProviderWorkspaceTable(error) || isMissingProviderWorkspaceRoleColumn(error)) return missingTableResult();
  if (isMissingProviderWorkspaceLinkColumn(error)) {
    return {
      ok: false,
      status: 500,
      data: {
        message: 'Bảng provider_workspaces thiếu cột linked_doctor_id hoặc linked_facility_id. Hãy cập nhật supabase/schema.sql rồi chạy SQL trong Supabase.',
      },
    };
  }

  return {
    ok: false,
    status: 500,
    data: {
      message: 'Không thể kiểm tra bảng provider_workspaces.',
      message: `Không thể kiểm tra bảng provider_workspaces: ${error.message}`,
      detail: error.message,
      code: error.code || '',
    },
  };
}

export async function getProviderWorkspace(firebaseUser) {
  const access = await requireRoles(firebaseUser, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC]);
  if (!access.ok) return access;

  if (!hasSupabaseConfig) {
    return { ok: false, status: 500, data: { message: 'Backend chưa cấu hình Supabase để tải hồ sơ đối tác.' } };
  }

  const firebaseUid = clean(firebaseUser?.localId || firebaseUser?.uid);
  if (!firebaseUid) {
    return { ok: false, status: 401, data: { message: 'Phiên đăng nhập không hợp lệ.' } };
  }

  const { data, error } = await supabase
    .from('provider_workspaces')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) {
    if (isMissingProviderWorkspaceTable(error)) {
      return { ok: true, status: 200, data: null };
    }
    return { ok: false, status: 500, data: { message: error.message } };
  }

  return { ok: true, status: 200, data: mapWorkspaceRow(data) };
}

export async function saveProviderWorkspace(firebaseUser, payload = {}) {
  const access = await requireRoles(firebaseUser, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC]);
  if (!access.ok) return access;

  const tableReady = await ensureProviderWorkspaceTableReady();
  if (!tableReady.ok) return tableReady;

  const validationMessage = validateWorkspacePayload(payload);
  if (validationMessage) {
    return { ok: false, status: 400, data: { message: validationMessage } };
  }

  const mode = clean(payload.mode);
  const providerRole = MODE_TO_APP_ROLE[mode] || 'doctor';
  const firebaseUid = clean(firebaseUser?.localId || firebaseUser?.uid);
  const email = normalizeEmail(firebaseUser?.email || payload.email);
  const ownerName = clean(payload.ownerName || firebaseUser?.displayName || email);
  const ownerPhone = clean(payload.ownerPhone);

  if (!firebaseUid || !email || !ownerName) {
    return { ok: false, status: 400, data: { message: 'Thiếu thông tin tài khoản đối tác.' } };
  }

  const accountResult = await upsertAppUser(firebaseUser, {
    role: providerRole,
    status: 'active',
    fullName: ownerName,
    email,
    emailVerified: true,
    markLogin: true,
  });
  if (!accountResult.ok) return accountResult;

  const { data: existing, error: lookupError } = await supabase
    .from('provider_workspaces')
    .select('id,status,linked_doctor_id,linked_facility_id')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, status: 500, data: { message: lookupError.message } };
  }

  const status = existing?.status === 'approved' ? 'approved' : 'pending_review';
  const now = new Date().toISOString();

  const row = {
    firebase_uid: firebaseUid,
    app_user_id: accountResult.data?.id || null,
    email,
    owner_name: ownerName,
    owner_phone: ownerPhone || null,
    mode,
    provider_role: providerRole,
    status,
    clinic_name: clean(payload.clinicName) || null,
    clinic_address: clean(payload.clinicAddress) || null,
    tax_code: clean(payload.taxCode) || null,
    doctor_title: mode === 'doctor' ? normalizeDoctorTitle(payload.doctorTitle) : null,
    specialty: clean(payload.specialty) || null,
    image_url: clean(payload.imageUrl) || null,
    submitted_at: status === 'pending_review' ? now : null,
  };

  const saveResult = existing?.id
    ? await supabase
      .from('provider_workspaces')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single()
    : await supabase
      .from('provider_workspaces')
      .insert(row)
      .select()
      .single();

  if (saveResult.error) {
    return { ok: false, status: 500, data: { message: saveResult.error.message } };
  }

  if (status !== 'approved') {
    await logProviderWorkspaceEvent({
      workspaceId: saveResult.data.id,
      actor: firebaseUser,
      actorRole: providerRole,
      eventType: existing?.id ? 'workspace_resubmitted' : 'workspace_submitted',
      entityType: 'provider_workspace',
      entityId: saveResult.data.id,
      message: existing?.id ? 'Provider updated and resubmitted workspace profile.' : 'Provider submitted workspace profile for review.',
      metadata: { mode, status },
    });
    return { ok: true, status: existing?.id ? 200 : 201, data: mapWorkspaceRow(saveResult.data) };
  }

  try {
    const linkPatch = await syncProviderCatalogLink(saveResult.data);
    const { data: linkedWorkspace, error: linkError } = await supabase
      .from('provider_workspaces')
      .update(linkPatch)
      .eq('id', saveResult.data.id)
      .select()
      .single();
    if (linkError) throw linkError;
    await logProviderWorkspaceEvent({
      workspaceId: linkedWorkspace.id,
      actor: firebaseUser,
      actorRole: providerRole,
      eventType: 'workspace_updated',
      entityType: 'provider_workspace',
      entityId: linkedWorkspace.id,
      message: 'Provider updated approved workspace profile.',
      metadata: { mode, status },
    });
    return { ok: true, status: existing?.id ? 200 : 201, data: mapWorkspaceRow(linkedWorkspace) };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: { message: `Không thể liên kết hồ sơ đối tác với catalog vận hành: ${error.message}` },
    };
  }
}

export async function getProviderWorkspaceOperations(firebaseUser) {
  const workspaceResult = await getProviderWorkspace(firebaseUser);
  if (!workspaceResult.ok) return workspaceResult;

  const workspace = workspaceResult.data;
  if (!workspace) {
    return { ok: true, status: 200, data: emptyOperations(null, 'Chưa có hồ sơ workspace.') };
  }

  if (workspace.status !== 'approved') {
    return {
      ok: true,
      status: 200,
      data: emptyOperations(workspace, 'Hồ sơ chưa được duyệt nên dữ liệu vận hành đang khóa.'),
    };
  }

  try {
    const { linkedDoctor, linkedFacility, linkedId } = await resolveProviderLink(workspace);

    if (!linkedId) {
      return {
        ok: true,
        status: 200,
        data: emptyOperations(workspace, 'Workspace đã duyệt nhưng chưa liên kết với danh mục bác sĩ/phòng khám.'),
      };
    }

    const linkedDoctorSpecialtyName = linkedDoctor
      ? await getSpecialtyNameById(linkedDoctor.specialty_id)
      : '';
    const today = todayDateValue();
    const toDate = futureDateValue(13);
    let appointmentQuery = supabase
      .from('appointments')
      .select('*, queue_tickets(*), clinic_specialties(name), facility_services(name)')
      .gte('appointment_date', today)
      .lte('appointment_date', toDate)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(80);

    appointmentQuery = workspace.mode === 'doctor'
      ? appointmentQuery.eq('doctor_id', linkedDoctor.id)
      : appointmentQuery.eq('facility_id', linkedFacility.id);

    const { data: appointmentRows, error: appointmentError } = await appointmentQuery;
    if (appointmentError) throw appointmentError;

    let slotQuery = supabase
      .from('appointment_slots')
      .select('id, slot_date, start_time, end_time, capacity, booked_count, is_active')
      .gte('slot_date', today)
      .lte('slot_date', toDate)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(120);

    slotQuery = workspace.mode === 'doctor'
      ? slotQuery.eq('doctor_id', linkedDoctor.id)
      : slotQuery.eq('facility_id', linkedFacility.id);

    const { data: slotRows, error: slotError } = await slotQuery;
    if (slotError) throw slotError;

    const appointments = (appointmentRows || []).map(mapAppointmentForProvider);
    const slots = (slotRows || []).map(mapSlotForProvider);
    const todayAppointments = appointments.filter((item) => item.date === today);
    const pendingAppointments = appointments.filter((item) => item.status === 'pending');
    const checkedIn = appointments.filter((item) => ['called', 'serving', 'done'].includes(item.queueStatus));
    const completedAppointments = appointments.filter((item) => item.status === 'completed');
    const cancelledAppointments = appointments.filter((item) => item.status === 'cancelled');
    const noShowRiskAppointments = appointments.filter((item) => item.riskLevel !== 'low');
    const availableSlots = slots
      .filter((slot) => slot.isActive)
      .reduce((total, slot) => total + slot.availableCount, 0);
    const reportByDate = new Map();
    const activity = await listProviderWorkspaceEvents(workspace.id);

    appointments.forEach((item) => {
      const current = reportByDate.get(item.date) || { date: item.date, total: 0, confirmed: 0, completed: 0, cancelled: 0 };
      current.total += 1;
      if (item.status === 'confirmed') current.confirmed += 1;
      if (item.status === 'completed') current.completed += 1;
      if (item.status === 'cancelled') current.cancelled += 1;
      reportByDate.set(item.date, current);
    });

    return {
      ok: true,
      status: 200,
      data: {
        workspace,
        linked: true,
        linkedDoctor: linkedDoctor ? {
          id: linkedDoctor.id,
          name: linkedDoctor.full_name,
          title: linkedDoctor.title || '',
          workplace: linkedDoctor.workplace_text || linkedDoctor.medical_facilities?.name || '',
          specialty: linkedDoctorSpecialtyName || workspace.specialty || '',
        } : null,
        linkedFacility: linkedFacility ? {
          id: linkedFacility.id,
          name: linkedFacility.name,
          address: linkedFacility.address || '',
          type: linkedFacility.type,
        } : null,
        summary: {
          todayAppointments: todayAppointments.length,
          pendingAppointments: pendingAppointments.length,
          availableSlots,
          checkedIn: checkedIn.length,
          completedAppointments: completedAppointments.length,
          cancelledAppointments: cancelledAppointments.length,
          noShowRiskAppointments: noShowRiskAppointments.length,
        },
        appointments,
        slots,
        services: [],
        report: Array.from(reportByDate.values()).slice(0, 14),
        activity,
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateProviderAppointmentStatus(firebaseUser, appointmentId, status) {
  const allowedStatuses = new Set(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']);
  if (!allowedStatuses.has(status)) {
    return { ok: false, status: 400, data: { message: 'Trạng thái lịch hẹn không hợp lệ.' } };
  }

  const operationsResult = await getProviderWorkspaceOperations(firebaseUser);
  if (!operationsResult.ok) return operationsResult;
  const appointment = operationsResult.data.appointments?.find((item) => item.id === appointmentId);
  if (!appointment) {
    return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch hẹn thuộc workspace này.' } };
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select()
    .single();
  if (error) return { ok: false, status: 500, data: { message: error.message } };

  const ticketStatus = {
    pending: 'waiting',
    confirmed: 'waiting',
    cancelled: 'cancelled',
    completed: 'done',
    no_show: 'cancelled',
  }[status];
  if (ticketStatus) {
    const { error: ticketError } = await supabase
      .from('queue_tickets')
      .update({ status: ticketStatus })
      .eq('appointment_id', appointmentId);
    if (ticketError) return { ok: false, status: 500, data: { message: ticketError.message } };
  }

  await logProviderWorkspaceEvent({
    workspaceId: operationsResult.data.workspace?.id,
    actor: firebaseUser,
    actorRole: operationsResult.data.workspace?.providerRole || operationsResult.data.workspace?.mode,
    eventType: 'appointment_status_changed',
    entityType: 'appointment',
    entityId: appointmentId,
    message: `Appointment status changed from ${appointment.status} to ${status}.`,
    metadata: {
      fromStatus: appointment.status,
      toStatus: status,
      patientName: appointment.patientName,
      appointmentDate: appointment.date,
      appointmentTime: appointment.time,
    },
  });

  return { ok: true, status: 200, data };
}

export async function saveProviderSlot(firebaseUser, payload = {}) {
  const workspaceResult = await getProviderWorkspace(firebaseUser);
  if (!workspaceResult.ok) return workspaceResult;

  const workspace = workspaceResult.data;
  if (!workspace) return { ok: false, status: 404, data: { message: 'Chưa có hồ sơ workspace.' } };
  if (workspace.status !== 'approved') {
    return { ok: false, status: 403, data: { message: 'Hồ sơ cần được duyệt trước khi cấu hình khung giờ.' } };
  }

  try {
    const { linkedDoctor, linkedFacility, linkedId } = await resolveProviderLink(workspace);
    if (!linkedId) {
      return { ok: false, status: 409, data: { message: 'Workspace chưa liên kết với bác sĩ/phòng khám trong catalog.' } };
    }

    const slotDate = clean(payload.date || payload.slotDate);
    const startTime = toTime(payload.startTime || payload.start_time);
    const durationMinutes = Math.min(Math.max(Number(payload.durationMinutes) || 30, 10), 240);
    const endTime = toTime(payload.endTime || payload.end_time) || addMinutes(startTime, durationMinutes);
    const capacity = Math.min(Math.max(Number(payload.capacity) || 1, 1), 100);

    if (!isValidDate(slotDate) || slotDate < todayDateValue()) {
      return { ok: false, status: 400, data: { message: 'Ngày mở slot không hợp lệ hoặc đã qua.' } };
    }
    if (!startTime || !endTime || formatTime(endTime) <= formatTime(startTime)) {
      return { ok: false, status: 400, data: { message: 'Giờ bắt đầu/kết thúc không hợp lệ.' } };
    }

    const baseRow = {
      facility_id: workspace.mode === 'doctor' ? linkedDoctor.facility_id || null : linkedFacility.id,
      doctor_id: workspace.mode === 'doctor' ? linkedDoctor.id : null,
      specialty_id: workspace.mode === 'doctor' ? linkedDoctor.specialty_id || null : null,
      service_id: null,
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      capacity,
      is_active: payload.isActive !== false,
    };

    let lookup = supabase
      .from('appointment_slots')
      .select('id, booked_count')
      .eq('slot_date', slotDate)
      .eq('start_time', startTime)
      .limit(1);
    lookup = workspace.mode === 'doctor'
      ? lookup.eq('doctor_id', linkedDoctor.id)
      : lookup.eq('facility_id', linkedFacility.id).is('doctor_id', null);

    const { data: existingRows, error: lookupError } = await lookup;
    if (lookupError) throw lookupError;
    const existing = existingRows?.[0] || null;

    if (existing && Number(existing.booked_count || 0) > capacity) {
      return { ok: false, status: 409, data: { message: 'Sức chứa mới nhỏ hơn số lịch đã đặt.' } };
    }

    const saveResult = existing?.id
      ? await supabase
        .from('appointment_slots')
        .update(baseRow)
        .eq('id', existing.id)
        .select()
        .single()
      : await supabase
        .from('appointment_slots')
        .insert({ ...baseRow, booked_count: 0 })
        .select()
        .single();

    if (saveResult.error) {
      if (!isDuplicateKeyError(saveResult.error)) throw saveResult.error;

      let retryLookup = supabase
        .from('appointment_slots')
        .select('*')
        .eq('slot_date', slotDate)
        .eq('start_time', startTime)
        .limit(1);
      retryLookup = workspace.mode === 'doctor'
        ? retryLookup.eq('doctor_id', linkedDoctor.id)
        : retryLookup.eq('facility_id', linkedFacility.id).is('doctor_id', null);

      const { data: retryRows, error: retryError } = await retryLookup;
      if (retryError) throw retryError;
      const retrySlot = retryRows?.[0] || null;
      if (!retrySlot) throw saveResult.error;
      return { ok: true, status: 200, data: mapSlotForProvider(retrySlot) };
    }
    await logProviderWorkspaceEvent({
      workspaceId: workspace.id,
      actor: firebaseUser,
      actorRole: workspace.providerRole || workspace.mode,
      eventType: existing?.id ? 'slot_updated' : 'slot_created',
      entityType: 'appointment_slot',
      entityId: saveResult.data.id,
      message: existing?.id ? 'Provider updated appointment slot.' : 'Provider created appointment slot.',
      metadata: {
        date: slotDate,
        startTime,
        endTime,
        capacity,
      },
    });
    return { ok: true, status: existing?.id ? 200 : 201, data: mapSlotForProvider(saveResult.data) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateProviderSlot(firebaseUser, slotId, payload = {}) {
  if (!isUuid(slotId)) return { ok: false, status: 400, data: { message: 'Slot không hợp lệ.' } };

  const operationsResult = await getProviderWorkspaceOperations(firebaseUser);
  if (!operationsResult.ok) return operationsResult;
  const slot = operationsResult.data.slots?.find((item) => item.id === slotId);
  if (!slot) return { ok: false, status: 404, data: { message: 'Không tìm thấy slot thuộc workspace này.' } };

  const patch = {};
  if (typeof payload.isActive === 'boolean') {
    if (!payload.isActive && slot.bookedCount > 0) {
      return { ok: false, status: 409, data: { message: 'Không thể khóa slot đã có lịch đặt.' } };
    }
    patch.is_active = payload.isActive;
  }
  if (payload.capacity !== undefined) {
    const capacity = Math.min(Math.max(Number(payload.capacity) || 1, 1), 100);
    if (capacity < slot.bookedCount) {
      return { ok: false, status: 409, data: { message: 'Sức chứa mới nhỏ hơn số lịch đã đặt.' } };
    }
    patch.capacity = capacity;
  }

  if (!Object.keys(patch).length) return { ok: true, status: 200, data: slot };

  const { data, error } = await supabase
    .from('appointment_slots')
    .update(patch)
    .eq('id', slotId)
    .select()
    .single();
  if (error) return { ok: false, status: 500, data: { message: error.message } };

  await logProviderWorkspaceEvent({
    workspaceId: operationsResult.data.workspace?.id,
    actor: firebaseUser,
    actorRole: operationsResult.data.workspace?.providerRole || operationsResult.data.workspace?.mode,
    eventType: 'slot_toggled',
    entityType: 'appointment_slot',
    entityId: slotId,
    message: patch.is_active === false ? 'Provider locked appointment slot.' : patch.is_active === true ? 'Provider reopened appointment slot.' : 'Provider updated slot capacity.',
    metadata: {
      previousActive: slot.isActive,
      nextActive: data.is_active,
      previousCapacity: slot.capacity,
      nextCapacity: data.capacity,
      date: slot.date,
      startTime: slot.startTime,
    },
  });

  return { ok: true, status: 200, data: mapSlotForProvider(data) };
}

export async function reviewProviderWorkspace(workspaceId, payload = {}) {
  const tableReady = await ensureProviderWorkspaceTableReady();
  if (!tableReady.ok) return tableReady;

  if (!isUuid(workspaceId)) {
    return { ok: false, status: 400, data: { message: 'Hồ sơ đối tác không hợp lệ.' } };
  }

  const status = clean(payload.status);
  if (!['approved', 'rejected', 'pending_review'].includes(status)) {
    return { ok: false, status: 400, data: { message: 'Trạng thái kiểm duyệt không hợp lệ.' } };
  }

  try {
    const { data: current, error: lookupError } = await supabase
      .from('provider_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();
    if (lookupError) throw lookupError;

    const { data: reviewed, error: reviewError } = await supabase
      .from('provider_workspaces')
      .update({
        status,
        review_note: clean(payload.reviewNote) || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)
      .select()
      .single();
    if (reviewError) throw reviewError;

    const linkPatch = await syncProviderCatalogLink({
      ...current,
      ...reviewed,
      status,
    });
    const { data: linkedWorkspace, error: linkError } = await supabase
      .from('provider_workspaces')
      .update(linkPatch)
      .eq('id', workspaceId)
      .select()
      .single();
    if (linkError) throw linkError;

    await logProviderWorkspaceEvent({
      workspaceId,
      actor: payload.actor,
      actorRole: payload.actorRole || 'admin',
      eventType: 'workspace_reviewed',
      entityType: 'provider_workspace',
      entityId: workspaceId,
      message: `Admin changed provider workspace status from ${current.status} to ${status}.`,
      metadata: {
        fromStatus: current.status,
        toStatus: status,
        reviewNote: clean(payload.reviewNote) || '',
        linkedDoctorId: linkedWorkspace.linked_doctor_id || '',
        linkedFacilityId: linkedWorkspace.linked_facility_id || '',
      },
    });

    return { ok: true, status: 200, data: mapWorkspaceRow(linkedWorkspace) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
