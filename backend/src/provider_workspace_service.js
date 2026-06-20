import { upsertAppUser } from './account_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { APP_ROLES, requireRoles } from './authorization_service.js';

const VALID_MODES = new Set(['doctor', 'clinic', 'hospital']);
const VALID_STATUSES = new Set(['draft', 'pending_review', 'approved', 'rejected']);
const VALID_DOCTOR_TITLES = new Set(['BS', 'BS.CKI', 'BS.CKII', 'ThS.BS', 'TS.BS', 'PGS.TS.BS', 'GS.TS.BS']);
const MODE_TO_APP_ROLE = {
  doctor: 'doctor',
  clinic: 'clinic',
  hospital: 'hospital',
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

function isUsableMapAddress(value = '') {
  const address = clean(value);
  return Boolean(
    address
    && address.length >= 12
    && /\s/.test(address)
    && /\p{L}/u.test(address)
  );
}

function digitsOnly(value = '') {
  return String(value || '').replace(/[^\d]/g, '');
}

function formatVndAmount(value) {
  const amount = Number(digitsOnly(value));
  if (!amount || amount < 0) return '';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} đ`;
}

function hasConsultationFeePayload(payload = {}) {
  return payload.consultationFee !== undefined
    || payload.consultation_fee !== undefined
    || payload.fee !== undefined
    || payload.feeText !== undefined;
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
    specialties: [],
    services: [],
    report: [],
    activity: [],
  };
}

function demoProviderWorkspace(firebaseUser = {}, payload = {}) {
  const email = normalizeEmail(firebaseUser?.email || payload.email || 'hoang_2251220149@dau.edu.vn');
  const ownerName = clean(payload.ownerName || firebaseUser?.displayName) || 'Bac si MidHealth Demo';
  return {
    id: 'demo-provider-workspace',
    firebaseUid: clean(firebaseUser?.localId || firebaseUser?.uid) || 'demo-provider',
    email,
    ownerName,
    ownerPhone: clean(payload.ownerPhone) || '0900000000',
    mode: clean(payload.mode) || 'doctor',
    providerRole: MODE_TO_APP_ROLE[clean(payload.mode)] || 'doctor',
    status: 'approved',
    linkedDoctorId: 'demo-doctor',
    linkedFacilityId: '',
    clinicName: clean(payload.clinicName) || 'Phong kham demo MidHealth',
    clinicAddress: clean(payload.clinicAddress) || '1 Nguyen Hue, Ben Nghe, TP.HCM',
    taxCode: clean(payload.taxCode) || '',
    doctorTitle: normalizeDoctorTitle(payload.doctorTitle) || 'BS',
    specialty: clean(payload.specialty) || 'Noi tong quat',
    imageUrl: clean(payload.imageUrl) || '',
    reviewNote: '',
    submittedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function demoProviderOperations(firebaseUser = {}, workspace = demoProviderWorkspace(firebaseUser)) {
  const today = todayDateValue();
  return {
    workspace,
    linked: true,
    reason: 'Che do demo dang hoat dong vi Vercel chua cau hinh Supabase.',
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
    report: [],
    activity: [
      {
        id: 'demo-activity',
        message: 'Workspace demo san sang cho buoi trinh bay.',
        createdAt: new Date().toISOString(),
      },
    ],
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
      .select('id, full_name, title, specialty_id, facility_id, workplace_text, unavailable_note, notice, medical_facilities(name, address)')
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
    .select('id, full_name, title, specialty_id, facility_id, workplace_text, unavailable_note, notice, medical_facilities(name, address)')
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

function facilityTypeForMode(mode) {
  return mode === 'hospital' ? 'hospital' : 'clinic';
}

function facilityLabelForMode(mode) {
  return mode === 'hospital' ? 'bệnh viện' : 'phòng khám';
}

function facilityDisplayTypeForMode(mode) {
  return mode === 'hospital' ? 'Bệnh viện' : 'Phòng khám';
}

function buildFacilitySubtitle(workspace) {
  const typeLabel = facilityDisplayTypeForMode(workspace.mode);
  const specialties = parseSpecialtyNames(workspace.specialty).slice(0, 2).join(', ');
  return specialties ? `${typeLabel} ${specialties}` : `${typeLabel} trên MidHealth`;
}

function buildFacilityIntro(workspace) {
  const typeLabel = facilityDisplayTypeForMode(workspace.mode).toLowerCase();
  const specialties = parseSpecialtyNames(workspace.specialty);
  const specialtyText = specialties.length
    ? ` tiếp nhận ${specialties.join(', ')}`
    : ' tiếp nhận đặt khám theo lịch hẹn';
  const addressText = workspace.clinicAddress ? ` tại ${workspace.clinicAddress}` : '';
  const phoneText = workspace.ownerPhone ? ` Người bệnh có thể đặt lịch trực tuyến hoặc liên hệ ${workspace.ownerPhone} khi cần hỗ trợ.` : '';
  return `${workspace.clinicName} là ${typeLabel}${specialtyText}${addressText}. Hồ sơ được MidHealth ghi nhận để người bệnh đặt lịch, chọn khung giờ và chuẩn bị thông tin trước khi đến khám.${phoneText}`;
}

async function findLinkedFacility(workspace) {
  if (!workspace || !['clinic', 'hospital'].includes(workspace.mode)) return null;

  if (workspace.linkedFacilityId && isUuid(workspace.linkedFacilityId)) {
    const { data, error } = await supabase
      .from('medical_facilities')
      .select('id, name, subtitle, intro, address, type, avatar_url, background_url, phone, hotline')
      .eq('id', workspace.linkedFacilityId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const clinicName = clean(workspace.clinicName);
  if (!clinicName) return null;
  const facilityType = facilityTypeForMode(workspace.mode);

  const { data, error } = await supabase
    .from('medical_facilities')
    .select('id, name, subtitle, intro, address, type, avatar_url, background_url, phone, hotline')
    .eq('type', facilityType)
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

function parseSpecialtyNames(value = '') {
  return Array.from(new Set(
    String(value || '')
      .split(/[,;\n]/)
      .map((item) => clean(item))
      .filter(Boolean),
  ));
}

function isDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function displayDateValue(value) {
  if (!isDateValue(value)) return '';
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

function buildDoctorUnavailableNotice({ startDate, endDate, reason }) {
  const startText = displayDateValue(startDate);
  const endText = displayDateValue(endDate);
  const reasonText = clean(reason);
  const rangeText = startDate === endDate
    ? `ngày ${startText}`
    : `từ ngày ${startText} đến hết ngày ${endText}`;
  return `Bác sĩ tạm nghỉ ${rangeText}${reasonText ? `: ${reasonText}` : '.'}`;
}

async function syncFacilitySpecialties(facilityId, specialtyText = '') {
  if (!isUuid(facilityId)) return [];
  const names = parseSpecialtyNames(specialtyText);
  if (!names.length) return [];

  const rows = [];
  for (const [index, name] of names.entries()) {
    const specialty = await findOrCreateSpecialty(name);
    rows.push({
      facility_id: facilityId,
      specialty_id: specialty.id,
      description: `Chuyên khoa ${name} do cơ sở đăng ký trên MidHealth.`,
      sort_order: index,
    });
  }

  const { error } = await supabase
    .from('facility_specialties')
    .upsert(rows, { onConflict: 'facility_id,specialty_id' });
  if (error) throw error;

  const current = await listFacilitySpecialties(facilityId);
  const nextIds = new Set(rows.map((row) => row.specialty_id));
  const staleRows = current.filter((item) => item.id && !nextIds.has(item.id));
  for (const stale of staleRows) {
    const { error: deleteError } = await supabase
      .from('facility_specialties')
      .delete()
      .eq('facility_id', facilityId)
      .eq('specialty_id', stale.id);
    if (deleteError) throw deleteError;
  }

  return rows;
}

async function ensureFacilityHours(facilityId) {
  if (!isUuid(facilityId)) return;
  const { data: existing, error: lookupError } = await supabase
    .from('facility_hours')
    .select('id')
    .eq('facility_id', facilityId)
    .limit(1);
  if (lookupError) throw lookupError;
  if (existing?.length) return;

  const rows = [
    { facility_id: facilityId, label: 'Thứ 2 - Thứ 6', time_text: '07:30 - 17:00', sort_order: 0 },
    { facility_id: facilityId, label: 'Thứ 7', time_text: '07:30 - 11:30', sort_order: 1 },
    { facility_id: facilityId, label: 'Chủ nhật', time_text: 'Theo lịch hẹn', sort_order: 2 },
  ];
  const { error } = await supabase.from('facility_hours').insert(rows);
  if (error) throw error;
}

async function ensureFacilityServices(facilityId, specialtyText = '') {
  if (!isUuid(facilityId)) return;
  const specialties = await listFacilitySpecialties(facilityId);
  const fallbackNames = parseSpecialtyNames(specialtyText);
  const serviceSources = specialties.length
    ? specialties
    : fallbackNames.map((name) => ({ id: null, name }));
  const rows = serviceSources.map((specialty, index) => ({
    facility_id: facilityId,
    specialty_id: isUuid(specialty.id) ? specialty.id : null,
    name: `Khám ${specialty.name || 'tổng quát'}`,
    description: `Dịch vụ khám và tư vấn ${String(specialty.name || 'tổng quát').toLowerCase()} tại cơ sở.`,
    fee_text: 'Theo bảng giá phòng khám',
    is_active: true,
    sort_order: index,
  }));

  if (!rows.length) {
    rows.push({
      facility_id: facilityId,
      specialty_id: null,
      name: 'Khám tổng quát',
      description: 'Dịch vụ khám và tư vấn tổng quát tại cơ sở.',
      fee_text: 'Theo bảng giá phòng khám',
      is_active: true,
      sort_order: 0,
    });
  }

  const { error } = await supabase
    .from('facility_services')
    .upsert(rows, { onConflict: 'facility_id,name' });
  if (error) throw error;
}

async function listFacilitySpecialties(facilityId) {
  if (!isUuid(facilityId)) return [];
  const { data, error } = await supabase
    .from('facility_specialties')
    .select('specialty_id, sort_order, clinic_specialties(id, name)')
    .eq('facility_id', facilityId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || [])
    .map((row) => ({
      id: row.clinic_specialties?.id || row.specialty_id,
      name: row.clinic_specialties?.name || '',
    }))
    .filter((item) => item.id && item.name);
}

async function listFacilityHours(facilityId) {
  if (!isUuid(facilityId)) return [];
  const { data, error } = await supabase
    .from('facility_hours')
    .select('label, time_text, sort_order')
    .eq('facility_id', facilityId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    label: row.label || '',
    time: row.time_text || '',
  })).filter((item) => item.label || item.time);
}

async function listFacilityServices(facilityId) {
  if (!isUuid(facilityId)) return [];
  const { data, error } = await supabase
    .from('facility_services')
    .select('id, specialty_id, name, description, fee_text, sort_order, is_active')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    specialtyId: row.specialty_id || '',
    name: row.name || '',
    description: row.description || '',
    fee: row.fee_text || '',
  })).filter((item) => item.name);
}

async function listFacilityImages(facilityId) {
  if (!isUuid(facilityId)) return [];
  const { data, error } = await supabase
    .from('facility_images')
    .select('image_url, sort_order')
    .eq('facility_id', facilityId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => row.image_url).filter(Boolean);
}

function cleanListItems(items, mapper, limit = 12) {
  return (Array.isArray(items) ? items : [])
    .map(mapper)
    .filter(Boolean)
    .slice(0, limit);
}

async function resolveFacilitySlotSpecialty(facilityId, payload = {}) {
  const specialties = await listFacilitySpecialties(facilityId);
  const requestedId = clean(payload.specialtyId || payload.specialty_id);
  const requestedName = clean(payload.specialtyName || payload.specialty);

  if (!specialties.length) {
    if (!requestedName) return { error: 'Cơ sở này chưa có chuyên khoa được duyệt. Hãy cập nhật hồ sơ và cho admin duyệt lại.', specialties };
    const specialty = await findOrCreateSpecialty(requestedName);
    await syncFacilitySpecialties(facilityId, requestedName);
    return { specialtyId: specialty.id, specialtyName: specialty.name, specialties: await listFacilitySpecialties(facilityId) };
  }

  const match = specialties.find((item) => (
    (requestedId && item.id === requestedId)
    || (requestedName && item.name.toLocaleLowerCase('vi') === requestedName.toLocaleLowerCase('vi'))
  ));

  if (!match) {
    return {
      error: requestedId || requestedName
        ? 'Chuyên khoa không thuộc cơ sở này hoặc chưa được duyệt.'
        : 'Vui lòng chọn chuyên khoa tiếp nhận cho khung giờ.',
      specialties,
    };
  }

  return { specialtyId: match.id, specialtyName: match.name, specialties };
}

async function syncHospitalConsultationFee(facilityId, specialty, feeValue) {
  if (!isUuid(facilityId) || !isUuid(specialty?.id)) return;
  const feeText = formatVndAmount(feeValue);
  if (!feeText) return;

  const name = `Khám ${specialty.name || 'chuyên khoa'}`;
  const { error } = await supabase
    .from('facility_services')
    .upsert({
      facility_id: facilityId,
      specialty_id: specialty.id,
      name,
      description: `Khám và tư vấn chuyên khoa ${String(specialty.name || '').toLowerCase()} tại bệnh viện.`,
      fee_text: feeText,
      is_active: true,
      sort_order: 0,
    }, { onConflict: 'facility_id,name' });
  if (error) throw error;
}

async function syncProviderCatalogLink(workspaceRow) {
  const workspace = mapWorkspaceRow(workspaceRow);
  const active = workspace.status === 'approved';

  if (workspace.mode === 'doctor') {
    const specialty = await findOrCreateSpecialty(workspace.specialty);
    const existingDoctor = workspace.linkedDoctorId ? null : await findLinkedDoctor(workspace);
    let facilityId = workspace.linkedFacilityId || existingDoctor?.facility_id || null;

    if (workspace.clinicAddress) {
      const facilityName = workspace.clinicName || `Phong kham ${workspace.ownerName}`;
      const facilityRow = {
        type: 'clinic',
        name: facilityName,
        subtitle: `Noi kham cua ${workspace.ownerName}`,
        intro: `${facilityName} la dia diem kham cua ${workspace.ownerName} tren MidHealth.`,
        address: workspace.clinicAddress,
        avatar_url: workspace.imageUrl || null,
        phone: workspace.ownerPhone || null,
        hotline: workspace.ownerPhone || null,
        is_active: active,
      };
      const facilityResult = facilityId
        ? await supabase
          .from('medical_facilities')
          .update(facilityRow)
          .eq('id', facilityId)
          .select('id')
          .single()
        : await supabase
          .from('medical_facilities')
          .insert({
            ...facilityRow,
            slug: `${slugify(facilityName)}-${String(workspace.firebaseUid).slice(0, 8)}`,
          })
          .select('id')
          .single();
      if (facilityResult.error) throw facilityResult.error;
      facilityId = facilityResult.data.id;
      await syncFacilitySpecialties(facilityId, workspace.specialty);
      await ensureFacilityHours(facilityId);
      await ensureFacilityServices(facilityId, workspace.specialty);
    }
    const doctorRow = {
      full_name: workspace.ownerName,
      initials: initialsFromName(workspace.ownerName),
      title: workspace.doctorTitle || null,
      specialty_id: specialty.id,
      facility_id: facilityId,
      workplace_text: workspace.clinicName || 'Bác sĩ độc lập trên MidHealth',
      avatar_url: workspace.imageUrl || null,
      intro: `Hồ sơ chuyên môn của ${workspace.ownerName} trên MidHealth.`,
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

    return { linked_doctor_id: result.data.id, linked_facility_id: facilityId };
  }

  const facilityType = facilityTypeForMode(workspace.mode);
  const existingFacility = workspace.linkedFacilityId ? null : await findLinkedFacility(workspace);
  const facilityRow = {
    type: facilityType,
    name: workspace.clinicName,
    subtitle: existingFacility?.subtitle || buildFacilitySubtitle(workspace),
    intro: existingFacility?.intro || buildFacilityIntro(workspace),
    address: workspace.clinicAddress,
    avatar_url: workspace.imageUrl || existingFacility?.avatar_url || null,
    background_url: existingFacility?.background_url || null,
    phone: workspace.ownerPhone || existingFacility?.phone || null,
    hotline: workspace.ownerPhone || existingFacility?.hotline || null,
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

  await syncFacilitySpecialties(result.data.id, workspace.specialty);
  await ensureFacilityHours(result.data.id);
  await ensureFacilityServices(result.data.id, workspace.specialty);

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
    appointmentSlotId: appointment.appointment_slot_id || '',
    time: appointmentTime,
    date: appointmentDate,
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone || '',
    reason: appointment.reason || appointment.note || 'Chưa có lý do khám',
    status: appointment.status,
    paymentStatus: appointment.payment_status,
    riskLevel,
    riskReason: riskLevel === 'high'
      ? 'Đã ghi nhận không đến'
      : isUnpaidConfirmed
        ? 'Đã xác nhận nhưng chưa thanh toán'
        : isPendingSoon
          ? 'Lịch sắp tới nhưng chưa xác nhận'
          : 'Rủi ro thấp',
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
    specialtyId: slot.specialty_id || '',
    specialtyName: slot.clinic_specialties?.name || '',
    serviceId: slot.service_id || '',
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

async function releaseAppointmentSlot(slotId) {
  if (!isUuid(slotId)) return;
  const { error } = await supabase.rpc('release_appointment_slot', { slot_id: slotId });
  if (error) throw error;
}

function validateWorkspacePayload(payload = {}) {
  const mode = clean(payload.mode);
  if (!VALID_MODES.has(mode)) {
    return 'Vui lòng chọn Bác sĩ độc lập, Phòng khám hoặc Bệnh viện.';
  }

  if (['clinic', 'hospital'].includes(mode)) {
    const label = mode === 'hospital' ? 'bệnh viện' : 'phòng khám';
    if (!clean(payload.clinicName)) return `Vui lòng nhập tên ${label}.`;
    if (!clean(payload.clinicAddress)) return `Vui lòng nhập địa chỉ ${label}.`;
    if (!isUsableMapAddress(payload.clinicAddress)) return 'Vui long nhap dia chi day du, vi du: 1B Nguyen Xi, Binh Loi Trung, TP.HCM.';
    if (mode === 'hospital' && !clean(payload.taxCode)) return 'Vui lòng nhập mã giấy phép hoạt động, mã KCB hoặc mã số thuế của bệnh viện.';
  }

  if (mode === 'doctor') {
    if (!VALID_DOCTOR_TITLES.has(normalizeDoctorTitle(payload.doctorTitle))) {
      return 'Vui lòng chọn danh xưng chuyên môn hợp lệ.';
    }
    if (!clean(payload.specialty)) {
      return 'Vui lòng chọn chuyên khoa chính của bác sĩ.';
    }
  }

  if (mode === 'doctor' && !clean(payload.clinicAddress)) {
    return 'Vui long nhap dia chi noi kham cua bac si.';
  }
  if (mode === 'doctor' && !isUsableMapAddress(payload.clinicAddress)) {
    return 'Vui long nhap dia chi noi kham day du, vi du: 1B Nguyen Xi, Binh Loi Trung, TP.HCM.';
  }

  return '';
}

export async function ensureProviderWorkspaceTableReady() {
  if (!hasSupabaseConfig) return { ok: true, skipped: true };

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
  const access = await requireRoles(firebaseUser, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
  if (!access.ok) return access;

  if (!hasSupabaseConfig) {
    return { ok: true, status: 200, data: demoProviderWorkspace(firebaseUser) };
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
  const access = await requireRoles(firebaseUser, [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL]);
  if (!access.ok) return access;

  if (!hasSupabaseConfig) {
    const validationMessage = validateWorkspacePayload(payload);
    if (validationMessage) {
      return { ok: false, status: 400, data: { message: validationMessage } };
    }
    return { ok: true, status: 200, data: demoProviderWorkspace(firebaseUser, payload) };
  }

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
    allowRoleChange: true,
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
  if (!hasSupabaseConfig) {
    return { ok: true, status: 200, data: demoProviderOperations(firebaseUser, workspace || demoProviderWorkspace(firebaseUser)) };
  }

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
        data: emptyOperations(workspace, 'Workspace đã duyệt nhưng chưa liên kết với danh mục bác sĩ/bệnh viện/phòng khám.'),
      };
    }

    const linkedDoctorSpecialtyName = linkedDoctor
      ? await getSpecialtyNameById(linkedDoctor.specialty_id)
      : '';
    const facilitySpecialties = linkedFacility ? await listFacilitySpecialties(linkedFacility.id) : [];
    const facilityHours = linkedFacility ? await listFacilityHours(linkedFacility.id) : [];
    const facilityServices = linkedFacility ? await listFacilityServices(linkedFacility.id) : [];
    const facilityImages = linkedFacility ? await listFacilityImages(linkedFacility.id) : [];
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
      .select('id, specialty_id, service_id, slot_date, start_time, end_time, capacity, booked_count, is_active, clinic_specialties(id, name)')
      .gte('slot_date', today)
      .lte('slot_date', toDate)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(120);

    slotQuery = workspace.mode === 'doctor'
      ? slotQuery.eq('doctor_id', linkedDoctor.id)
      : slotQuery.eq('facility_id', linkedFacility.id).is('doctor_id', null);

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
          unavailableNote: linkedDoctor.unavailable_note || '',
          notice: linkedDoctor.unavailable_note || linkedDoctor.notice || '',
        } : null,
        linkedFacility: linkedFacility ? {
          id: linkedFacility.id,
          name: linkedFacility.name,
          subtitle: linkedFacility.subtitle || '',
          intro: linkedFacility.intro || '',
          address: linkedFacility.address || '',
          type: linkedFacility.type,
          avatarUrl: linkedFacility.avatar_url || '',
          backgroundUrl: linkedFacility.background_url || '',
          phone: linkedFacility.phone || linkedFacility.hotline || '',
          specialties: facilitySpecialties,
          hours: facilityHours,
          services: facilityServices,
          images: facilityImages,
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
        specialties: linkedDoctor
          ? [{ id: linkedDoctor.specialty_id || '', name: linkedDoctorSpecialtyName || workspace.specialty || '' }].filter((item) => item.id || item.name)
          : facilitySpecialties,
        unavailability: linkedDoctor ? {
          notice: linkedDoctor.unavailable_note || '',
        } : null,
        services: facilityServices,
        hours: facilityHours,
        images: facilityImages,
        report: Array.from(reportByDate.values()).slice(0, 14),
        activity,
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateProviderFacilityDetails(firebaseUser, payload = {}) {
  const workspaceResult = await getProviderWorkspace(firebaseUser);
  if (!workspaceResult.ok) return workspaceResult;

  const workspace = workspaceResult.data;
  if (!workspace) {
    return { ok: false, status: 404, data: { message: 'Chưa có hồ sơ workspace.' } };
  }
  if (!['clinic', 'hospital'].includes(workspace.mode)) {
    return { ok: false, status: 400, data: { message: 'Chức năng này chỉ áp dụng cho phòng khám hoặc bệnh viện.' } };
  }
  if (workspace.status !== 'approved') {
    return { ok: false, status: 403, data: { message: 'Hồ sơ cần được duyệt trước khi cập nhật trang hiển thị.' } };
  }

  const linkedFacility = await findLinkedFacility(workspace);
  if (!linkedFacility?.id) {
    return { ok: false, status: 409, data: { message: 'Workspace chưa liên kết với phòng khám/bệnh viện trong catalog.' } };
  }

  const subtitle = clean(payload.subtitle);
  const intro = clean(payload.intro);
  const phone = clean(payload.phone);
  const address = clean(payload.address);
  if (address && !isUsableMapAddress(address)) {
    return { ok: false, status: 400, data: { message: 'Vui long nhap dia chi day du, vi du: 1B Nguyen Xi, Binh Loi Trung, TP.HCM.' } };
  }
  const avatarUrl = clean(payload.avatarUrl);
  const backgroundUrl = clean(payload.backgroundUrl);
  const hours = cleanListItems(payload.hours, (item) => {
    const label = clean(item?.label);
    const time = clean(item?.time || item?.timeText);
    return label || time ? { label, time } : null;
  }, 8);
  const services = cleanListItems(payload.services, (item) => {
    const name = clean(item?.name);
    if (!name) return null;
    return {
      id: clean(item?.id),
      specialtyId: clean(item?.specialtyId || item?.specialty_id),
      name,
      description: clean(item?.description),
      fee: clean(item?.fee || item?.feeText || item?.fee_text),
    };
  }, 20);
  const images = cleanListItems(payload.images, (item) => clean(typeof item === 'string' ? item : item?.url || item?.imageUrl), 8);

  const facilityPatch = {
    subtitle: subtitle || buildFacilitySubtitle(workspace),
    intro: intro || buildFacilityIntro(workspace),
    address: address || linkedFacility.address || workspace.clinicAddress,
    phone: phone || workspace.ownerPhone || null,
    hotline: phone || workspace.ownerPhone || null,
  };
  if (avatarUrl) facilityPatch.avatar_url = avatarUrl;
  if (backgroundUrl) facilityPatch.background_url = backgroundUrl;

  const { error: facilityError } = await supabase
    .from('medical_facilities')
    .update(facilityPatch)
    .eq('id', linkedFacility.id);
  if (facilityError) return { ok: false, status: 500, data: { message: facilityError.message } };

  if (hours.length) {
    const { error: deleteHourError } = await supabase
      .from('facility_hours')
      .delete()
      .eq('facility_id', linkedFacility.id);
    if (deleteHourError) return { ok: false, status: 500, data: { message: deleteHourError.message } };

    const { error: hourError } = await supabase
      .from('facility_hours')
      .insert(hours.map((item, index) => ({
        facility_id: linkedFacility.id,
        label: item.label || `Khung giờ ${index + 1}`,
        time_text: item.time || 'Theo lịch hẹn',
        sort_order: index,
      })));
    if (hourError) return { ok: false, status: 500, data: { message: hourError.message } };
  }

  if (services.length) {
    const { error: deactivateError } = await supabase
      .from('facility_services')
      .update({ is_active: false })
      .eq('facility_id', linkedFacility.id);
    if (deactivateError) return { ok: false, status: 500, data: { message: deactivateError.message } };

    const { error: serviceError } = await supabase
      .from('facility_services')
      .upsert(services.map((item, index) => ({
        facility_id: linkedFacility.id,
        specialty_id: isUuid(item.specialtyId) ? item.specialtyId : null,
        name: item.name,
        description: item.description || `Dịch vụ ${item.name} tại cơ sở.`,
        fee_text: item.fee || 'Theo bảng giá cơ sở',
        is_active: true,
        sort_order: index,
      })), { onConflict: 'facility_id,name' });
    if (serviceError) return { ok: false, status: 500, data: { message: serviceError.message } };
  }

  const { error: deleteImageError } = await supabase
    .from('facility_images')
    .delete()
    .eq('facility_id', linkedFacility.id);
  if (deleteImageError) return { ok: false, status: 500, data: { message: deleteImageError.message } };
  if (images.length) {
    const { error: imageError } = await supabase
      .from('facility_images')
      .insert(images.map((imageUrl, index) => ({
        facility_id: linkedFacility.id,
        image_url: imageUrl,
        sort_order: index,
      })));
    if (imageError) return { ok: false, status: 500, data: { message: imageError.message } };
  }

  await logProviderWorkspaceEvent({
    workspaceId: workspace.id,
    actor: firebaseUser,
    actorRole: workspace.providerRole || workspace.mode,
    eventType: 'facility_details_updated',
    entityType: 'medical_facility',
    entityId: linkedFacility.id,
    message: 'Facility public details updated.',
    metadata: { hours: hours.length, services: services.length, images: images.length },
  });

  return {
    ok: true,
    status: 200,
    data: {
      facilityId: linkedFacility.id,
      address: facilityPatch.address || '',
      subtitle: facilityPatch.subtitle,
      intro: facilityPatch.intro,
      phone: facilityPatch.phone || '',
      hours: await listFacilityHours(linkedFacility.id),
      services: await listFacilityServices(linkedFacility.id),
      images: await listFacilityImages(linkedFacility.id),
    },
  };
}

export async function updateProviderUnavailability(firebaseUser, payload = {}) {
  const workspaceResult = await getProviderWorkspace(firebaseUser);
  if (!workspaceResult.ok) return workspaceResult;

  const workspace = workspaceResult.data;
  if (!workspace) {
    return { ok: false, status: 404, data: { message: 'Chưa có hồ sơ workspace.' } };
  }
  if (workspace.mode !== 'doctor') {
    return { ok: false, status: 400, data: { message: 'Chức năng nghỉ chỉ áp dụng cho hồ sơ bác sĩ.' } };
  }
  if (workspace.status !== 'approved') {
    return { ok: false, status: 403, data: { message: 'Hồ sơ cần được duyệt trước khi cập nhật lịch nghỉ.' } };
  }

  const linkedDoctor = await findLinkedDoctor(workspace);
  if (!linkedDoctor?.id) {
    return { ok: false, status: 409, data: { message: 'Workspace chưa liên kết với hồ sơ bác sĩ trong catalog.' } };
  }

  const enabled = payload.enabled !== false;
  const startDate = clean(payload.startDate || payload.fromDate);
  const endDate = clean(payload.endDate || payload.toDate);
  const reason = clean(payload.reason);
  let unavailableNote = null;

  if (enabled) {
    if (!isDateValue(startDate) || !isDateValue(endDate)) {
      return { ok: false, status: 400, data: { message: 'Vui lòng chọn ngày bắt đầu và ngày kết thúc hợp lệ.' } };
    }
    if (startDate > endDate) {
      return { ok: false, status: 400, data: { message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' } };
    }
    unavailableNote = buildDoctorUnavailableNotice({ startDate, endDate, reason });
  }

  const { data, error } = await supabase
    .from('doctors')
    .update({ unavailable_note: unavailableNote })
    .eq('id', linkedDoctor.id)
    .select('id, unavailable_note')
    .single();
  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  if (enabled) {
    const { error: slotError } = await supabase
      .from('appointment_slots')
      .update({ is_active: false })
      .eq('doctor_id', linkedDoctor.id)
      .eq('booked_count', 0)
      .gte('slot_date', startDate)
      .lte('slot_date', endDate);
    if (slotError) {
      return { ok: false, status: 500, data: { message: slotError.message } };
    }
  }

  await logProviderWorkspaceEvent({
    workspaceId: workspace.id,
    actor: firebaseUser,
    actorRole: workspace.providerRole || 'doctor',
    eventType: enabled ? 'doctor_unavailability_saved' : 'doctor_unavailability_cleared',
    entityType: 'doctor',
    entityId: linkedDoctor.id,
    message: enabled ? 'Doctor saved unavailable period.' : 'Doctor cleared unavailable period.',
    metadata: { startDate, endDate, reason },
  });

  return {
    ok: true,
    status: 200,
    data: {
      doctorId: data.id,
      notice: data.unavailable_note || '',
    },
  };
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

  if (status === 'cancelled' && appointment.status !== 'cancelled' && appointment.appointmentSlotId) {
    try {
      await releaseAppointmentSlot(appointment.appointmentSlotId);
    } catch (error) {
      return { ok: false, status: 500, data: { message: error.message } };
    }
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
      return { ok: false, status: 409, data: { message: 'Workspace chưa liên kết với bác sĩ/bệnh viện/phòng khám trong catalog.' } };
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

    const facilitySpecialty = workspace.mode === 'doctor'
      ? { specialtyId: linkedDoctor.specialty_id || null }
      : await resolveFacilitySlotSpecialty(linkedFacility.id, payload);
    if (facilitySpecialty.error) {
      return { ok: false, status: 400, data: { message: facilitySpecialty.error, specialties: facilitySpecialty.specialties || [] } };
    }
    if (workspace.mode === 'hospital') {
      await syncHospitalConsultationFee(linkedFacility.id, {
        id: facilitySpecialty.specialtyId,
        name: facilitySpecialty.specialtyName || clean(payload.specialtyName || payload.specialty),
      }, payload.consultationFee || payload.consultation_fee || payload.fee || payload.feeText);
    }

    const baseRow = {
      facility_id: workspace.mode === 'doctor' ? linkedDoctor.facility_id || null : linkedFacility.id,
      doctor_id: workspace.mode === 'doctor' ? linkedDoctor.id : null,
      specialty_id: facilitySpecialty.specialtyId || null,
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
      : lookup
        .eq('facility_id', linkedFacility.id)
        .is('doctor_id', null)
        .eq('specialty_id', facilitySpecialty.specialtyId);

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
        : retryLookup
          .eq('facility_id', linkedFacility.id)
          .is('doctor_id', null)
          .eq('specialty_id', facilitySpecialty.specialtyId);

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
        specialtyId: facilitySpecialty.specialtyId || '',
        consultationFee: workspace.mode === 'hospital' ? formatVndAmount(payload.consultationFee || payload.consultation_fee || payload.fee || payload.feeText) : '',
      },
    });
    return { ok: true, status: existing?.id ? 200 : 201, data: mapSlotForProvider(saveResult.data) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateProviderSlot(firebaseUser, slotId, payload = {}) {
  if (payload.delete === true || payload.action === 'delete') {
    return deleteProviderSlot(firebaseUser, slotId);
  }

  if (!isUuid(slotId)) return { ok: false, status: 400, data: { message: 'Slot không hợp lệ.' } };

  const operationsResult = await getProviderWorkspaceOperations(firebaseUser);
  if (!operationsResult.ok) return operationsResult;
  const slot = operationsResult.data.slots?.find((item) => item.id === slotId);
  if (!slot) return { ok: false, status: 404, data: { message: 'Không tìm thấy slot thuộc workspace này.' } };

  const workspace = operationsResult.data.workspace;
  const linkedDoctor = operationsResult.data.linkedDoctor;
  const linkedFacility = operationsResult.data.linkedFacility;
  const isFacilityWorkspace = workspace?.mode === 'clinic' || workspace?.mode === 'hospital';

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
  if (payload.date !== undefined || payload.slotDate !== undefined) {
    const slotDate = clean(payload.date || payload.slotDate);
    if (!isValidDate(slotDate) || slotDate < todayDateValue()) {
      return { ok: false, status: 400, data: { message: 'Ngay mo slot khong hop le hoac da qua.' } };
    }
    if (slot.bookedCount > 0 && slotDate !== slot.date) {
      return { ok: false, status: 409, data: { message: 'Khong the doi ngay cua slot da co lich dat.' } };
    }
    patch.slot_date = slotDate;
  }
  if (payload.startTime !== undefined || payload.start_time !== undefined) {
    const startTime = toTime(payload.startTime || payload.start_time);
    if (!startTime) return { ok: false, status: 400, data: { message: 'Gio bat dau khong hop le.' } };
    if (slot.bookedCount > 0 && formatTime(startTime) !== slot.startTime) {
      return { ok: false, status: 409, data: { message: 'Khong the doi gio bat dau cua slot da co lich dat.' } };
    }
    patch.start_time = startTime;
  }
  if (payload.endTime !== undefined || payload.end_time !== undefined) {
    const endTime = toTime(payload.endTime || payload.end_time);
    if (!endTime) return { ok: false, status: 400, data: { message: 'Gio ket thuc khong hop le.' } };
    if (slot.bookedCount > 0 && formatTime(endTime) !== slot.endTime) {
      return { ok: false, status: 409, data: { message: 'Khong the doi gio ket thuc cua slot da co lich dat.' } };
    }
    patch.end_time = endTime;
  }
  const nextStartTime = patch.start_time || `${slot.startTime}:00`;
  const nextEndTime = patch.end_time || `${slot.endTime}:00`;
  if (formatTime(nextEndTime) <= formatTime(nextStartTime)) {
    return { ok: false, status: 400, data: { message: 'Gio ket thuc phai sau gio bat dau.' } };
  }
  let resolvedSpecialtyForFee = null;
  if (isFacilityWorkspace && (
    payload.specialtyId !== undefined
    || payload.specialty_id !== undefined
    || payload.specialtyName !== undefined
  )) {
    if (slot.bookedCount > 0) {
      return { ok: false, status: 409, data: { message: 'Khong the doi chuyen khoa cua slot da co lich dat.' } };
    }
    const facilitySpecialty = await resolveFacilitySlotSpecialty(linkedFacility?.id, payload);
    if (facilitySpecialty.error) {
      return { ok: false, status: 400, data: { message: facilitySpecialty.error, specialties: facilitySpecialty.specialties || [] } };
    }
    patch.specialty_id = facilitySpecialty.specialtyId || null;
    resolvedSpecialtyForFee = {
      id: facilitySpecialty.specialtyId,
      name: facilitySpecialty.specialtyName || clean(payload.specialtyName || payload.specialty),
    };
  }

  if (workspace?.mode === 'hospital' && hasConsultationFeePayload(payload)) {
    const feeSpecialty = resolvedSpecialtyForFee || {
      id: patch.specialty_id !== undefined ? patch.specialty_id : slot.specialtyId,
      name: slot.specialtyName || clean(payload.specialtyName || payload.specialty),
    };
    await syncHospitalConsultationFee(linkedFacility?.id, feeSpecialty, payload.consultationFee || payload.consultation_fee || payload.fee || payload.feeText);
  }

  if (!Object.keys(patch).length) return { ok: true, status: 200, data: slot };

  const nextDate = patch.slot_date || slot.date;
  const nextStart = patch.start_time || `${slot.startTime}:00`;
  const nextSpecialtyId = patch.specialty_id !== undefined ? patch.specialty_id : slot.specialtyId || null;
  let conflictQuery = supabase
    .from('appointment_slots')
    .select('id')
    .neq('id', slotId)
    .eq('slot_date', nextDate)
    .eq('start_time', nextStart)
    .limit(1);
  conflictQuery = workspace?.mode === 'doctor'
    ? conflictQuery.eq('doctor_id', linkedDoctor?.id)
    : conflictQuery
      .eq('facility_id', linkedFacility?.id)
      .is('doctor_id', null)
      .eq('specialty_id', nextSpecialtyId);

  const { data: conflicts, error: conflictError } = await conflictQuery;
  if (conflictError) return { ok: false, status: 500, data: { message: conflictError.message } };
  if (conflicts?.length) {
    return { ok: false, status: 409, data: { message: 'Da co khung gio trung ngay, gio va chuyen khoa.' } };
  }

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

export async function deleteProviderSlot(firebaseUser, slotId) {
  if (!isUuid(slotId)) return { ok: false, status: 400, data: { message: 'Slot khong hop le.' } };

  const operationsResult = await getProviderWorkspaceOperations(firebaseUser);
  if (!operationsResult.ok) return operationsResult;
  const slot = operationsResult.data.slots?.find((item) => item.id === slotId);
  if (!slot) return { ok: false, status: 404, data: { message: 'Khong tim thay slot thuoc workspace nay.' } };
  if (slot.bookedCount > 0) {
    return { ok: false, status: 409, data: { message: 'Khong the xoa slot da co lich dat.' } };
  }

  const { data: deletedRows, error } = await supabase
    .from('appointment_slots')
    .delete()
    .eq('id', slotId)
    .eq('booked_count', 0)
    .select('id');
  if (error) return { ok: false, status: 500, data: { message: error.message } };
  if (!deletedRows?.length) {
    return { ok: false, status: 409, data: { message: 'Không thể xóa slot. Slot có thể đã có lịch đặt hoặc không còn tồn tại.' } };
  }

  await logProviderWorkspaceEvent({
    workspaceId: operationsResult.data.workspace?.id,
    actor: firebaseUser,
    actorRole: operationsResult.data.workspace?.providerRole || operationsResult.data.workspace?.mode,
    eventType: 'slot_deleted',
    entityType: 'appointment_slot',
    entityId: slotId,
    message: 'Provider deleted appointment slot.',
    metadata: {
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
    },
  });

  return { ok: true, status: 200, data: { id: slotId } };
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
