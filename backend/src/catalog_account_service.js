import { hasSupabaseConfig, supabase } from './supabase.js';

const MANAGED_PROVIDER = 'catalog';
const MANAGED_DOMAIN = 'catalog.midhealth.local';

function normalizeName(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function managedIdentity(kind, entity) {
  const token = String(entity.slug || entity.id)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return {
    firebaseUid: `catalog:${kind}:${entity.id}`,
    email: `${kind}+${token || entity.id}@${MANAGED_DOMAIN}`,
  };
}

async function upsertManagedUser({ kind, entity, fullName, avatarUrl }) {
  const identity = managedIdentity(kind, entity);
  const { data, error } = await supabase
    .from('app_users')
    .upsert({
      firebase_uid: identity.firebaseUid,
      email: identity.email,
      full_name: fullName,
      avatar_url: avatarUrl || null,
      role: kind === 'clinic' ? 'clinic' : 'doctor',
      status: 'pending',
      auth_provider: MANAGED_PROVIDER,
      email_verified: false,
    }, { onConflict: 'firebase_uid' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createDoctorWorkspace(doctor, user) {
  const facility = doctor.medical_facilities;
  const now = new Date().toISOString();
  const { error } = await supabase.from('provider_workspaces').upsert({
    firebase_uid: user.firebase_uid,
    app_user_id: user.id,
    email: user.email,
    owner_name: doctor.full_name,
    mode: 'doctor',
    provider_role: 'doctor',
    linked_doctor_id: doctor.id,
    linked_facility_id: null,
    status: 'approved',
    clinic_name: facility?.name || doctor.workplace_text || null,
    clinic_address: facility?.address || null,
    doctor_title: doctor.title || null,
    specialty: doctor.clinic_specialties?.name || 'Khám tổng quát',
    image_url: doctor.avatar_url || null,
    review_note: 'Hồ sơ catalog nội bộ được hệ thống đồng bộ.',
    submitted_at: now,
    reviewed_at: now,
  }, { onConflict: 'firebase_uid' });
  if (error) throw error;
}

async function createClinicWorkspace(facility, user) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('provider_workspaces').upsert({
    firebase_uid: user.firebase_uid,
    app_user_id: user.id,
    email: user.email,
    owner_name: facility.name,
    owner_phone: facility.phone || facility.hotline || null,
    mode: 'clinic',
    provider_role: 'clinic',
    linked_doctor_id: null,
    linked_facility_id: facility.id,
    status: 'approved',
    clinic_name: facility.name,
    clinic_address: facility.address || 'Chưa cập nhật địa chỉ',
    image_url: facility.avatar_url || null,
    review_note: 'Hồ sơ catalog nội bộ được hệ thống đồng bộ.',
    submitted_at: now,
    reviewed_at: now,
  }, { onConflict: 'firebase_uid' });
  if (error) throw error;
}

export async function syncCatalogManagedAccounts() {
  if (!hasSupabaseConfig) throw new Error('Backend chưa cấu hình Supabase.');

  const [doctorResult, facilityResult, workspaceResult] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, slug, full_name, title, workplace_text, avatar_url, clinic_specialties(name), medical_facilities(name, address)')
      .order('created_at', { ascending: true }),
    supabase
      .from('medical_facilities')
      .select('id, slug, type, name, address, phone, hotline, avatar_url')
      .eq('type', 'clinic')
      .order('created_at', { ascending: true }),
    supabase
      .from('provider_workspaces')
      .select('id, linked_doctor_id, linked_facility_id'),
  ]);

  if (doctorResult.error) throw doctorResult.error;
  if (facilityResult.error) throw facilityResult.error;
  if (workspaceResult.error) throw workspaceResult.error;

  const workspaces = workspaceResult.data || [];
  const linkedDoctorIds = new Set(workspaces.map((row) => row.linked_doctor_id).filter(Boolean));
  const linkedFacilityIds = new Set(workspaces.map((row) => row.linked_facility_id).filter(Boolean));
  const doctors = doctorResult.data || [];
  const linkedDoctorNames = new Set(
    doctors
      .filter((doctor) => linkedDoctorIds.has(doctor.id))
      .map((doctor) => normalizeName(doctor.full_name)),
  );
  const result = { doctorsCreated: 0, clinicsCreated: 0, alreadyLinked: 0, duplicatesSkipped: 0 };

  for (const doctor of doctors) {
    if (linkedDoctorIds.has(doctor.id)) {
      result.alreadyLinked += 1;
      continue;
    }
    if (linkedDoctorNames.has(normalizeName(doctor.full_name))) {
      result.duplicatesSkipped += 1;
      continue;
    }
    const user = await upsertManagedUser({
      kind: 'doctor',
      entity: doctor,
      fullName: doctor.full_name,
      avatarUrl: doctor.avatar_url,
    });
    await createDoctorWorkspace(doctor, user);
    linkedDoctorNames.add(normalizeName(doctor.full_name));
    result.doctorsCreated += 1;
  }

  for (const facility of facilityResult.data || []) {
    if (linkedFacilityIds.has(facility.id)) {
      result.alreadyLinked += 1;
      continue;
    }
    const user = await upsertManagedUser({
      kind: 'clinic',
      entity: facility,
      fullName: facility.name,
      avatarUrl: facility.avatar_url,
    });
    await createClinicWorkspace(facility, user);
    result.clinicsCreated += 1;
  }

  return result;
}
