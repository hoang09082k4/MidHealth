import { APP_ROLES, requireRoles } from './authorization_service.js';
import { checkInAppointmentAsAdmin } from './admin_service.js';
import { supabase } from './supabase.js';
import { getClinic } from './clinic_service.js';
import crypto from 'node:crypto';
import { clinicDateTime, isFutureBooking, resolveConsultationFee, validDate } from './booking_policy.js';

const fail = (message, status = 400) => ({ ok: false, status, data: { message } });

export async function listStaffAppointments(user, code = '') {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  const searchCode = String(code || '').trim().toUpperCase();
  if (searchCode && !/^MHA[0-9]{6}-[0-9]+$/.test(searchCode)) return fail('Mã hẹn không hợp lệ.');
  let query = supabase.from('queue_tickets')
    .select('appointment_code,appointments(id,patient_name,appointment_date,appointment_time_text,status,payment_status,final_amount,deposit_amount,clinician_absent,checked_in_at,doctors(full_name))')
    .order('created_at', { ascending: false }).limit(searchCode ? 1 : 100);
  if (searchCode) query = query.eq('appointment_code', searchCode);
  const { data, error } = await query;
  if (error) return fail('Không thể tải lịch tiếp nhận.', 503);
  return { ok: true, status: 200, data: (data || []).map(row => ({
    code: row.appointment_code,
    ...(Array.isArray(row.appointments) ? row.appointments[0] : row.appointments),
  })).filter(row => row.id) };
}

export async function checkInByCode(user, payload = {}) {
  const code = String(payload.code || '').trim().toUpperCase();
  if (!/^MHA[0-9]{6}-[0-9]+$/.test(code)) return fail('Cần nhập mã hẹn hợp lệ.');
  const found = await listStaffAppointments(user, code);
  if (!found.ok) return found;
  const appointment = found.data[0];
  if (!appointment) return fail('Không tìm thấy mã hẹn.', 404);
  return checkInAppointmentAsAdmin(user, appointment.id, payload);
}

function normalizeSearchPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}

export async function listCounterPatients(user, query = '') {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  const term = String(query || '').replace(/[%_*]/g, '').trim();
  if (term.length < 2 || term.length > 80) return fail('Nhập ít nhất 2 ký tự để tìm bệnh nhân.');
  const fields = ['full_name', 'phone', 'email'];
  const pattern = `%${term}%`;
  const rawPhoneDigits = term.replace(/\D/g, '');
  const phoneDigits = rawPhoneDigits.startsWith('84') && rawPhoneDigits.length >= 11
    ? `0${rawPhoneDigits.slice(2)}`
    : rawPhoneDigits;
  const phoneSearch = /^[+\d\s().-]+$/.test(term) && phoneDigits.length >= 7;
  const phonePatterns = phoneSearch
    ? [phoneDigits, phoneDigits.startsWith('0') ? `84${phoneDigits.slice(1)}` : phoneDigits]
      .map(value => `%${value.split('').join('%')}%`)
    : [];
  const searchFields = phoneSearch ? ['phone'] : fields;
  const [profileResults, ownerResults, profilePhoneResults, ownerPhoneResults] = await Promise.all([
    Promise.all(searchFields.map(field => supabase.from('patient_medical_profiles')
      .select('id,owner_profile_id,full_name,date_of_birth,phone,gender,email,health_insurance_number,medical_history,blood_group,allergies')
      .ilike(field, pattern).limit(30))),
    Promise.all(searchFields.map(field => supabase.from('patient_profiles')
      .select('id,full_name,email,phone').ilike(field, pattern).limit(30))),
    Promise.all(phonePatterns.map(phonePattern => supabase.from('patient_medical_profiles')
      .select('id,owner_profile_id,full_name,date_of_birth,phone,gender,email,health_insurance_number,medical_history,blood_group,allergies')
      .ilike('phone', phonePattern).limit(100))),
    Promise.all(phonePatterns.map(phonePattern => supabase.from('patient_profiles')
      .select('id,full_name,email,phone').ilike('phone', phonePattern).limit(100))),
  ]);
  const allSearchResults = [...profileResults, ...ownerResults, ...profilePhoneResults, ...ownerPhoneResults];
  if (allSearchResults.some(result => result.error)) return fail('Kh\u00f4ng th\u1ec3 t\u00ecm h\u1ed3 s\u01a1 b\u1ec7nh nh\u00e2n.', 503);
  const owners = new Map();
  for (const result of ownerResults) for (const owner of result.data || []) owners.set(owner.id, owner);
  const matchesPhone = value => normalizeSearchPhone(value).includes(phoneDigits);
  if (phoneSearch) {
    for (const result of ownerPhoneResults) for (const owner of result.data || []) {
      if (matchesPhone(owner.phone)) owners.set(owner.id, owner);
    }
  }
  const ownerIds = [...owners.keys()];
  const linkedProfiles = ownerIds.length
    ? await supabase.from('patient_medical_profiles')
      .select('id,owner_profile_id,full_name,date_of_birth,phone,gender,email,health_insurance_number,medical_history,blood_group,allergies')
      .in('owner_profile_id', ownerIds).limit(100)
    : { data: [], error: null };
  if (linkedProfiles.error) return fail('Kh\u00f4ng th\u1ec3 t\u00ecm h\u1ed3 s\u01a1 b\u1ec7nh nh\u00e2n.', 503);
  const unique = new Map();
  for (const result of profileResults) for (const patient of result.data || []) unique.set(patient.id, patient);
  if (phoneSearch) for (const result of profilePhoneResults) for (const patient of result.data || []) {
    if (matchesPhone(patient.phone)) unique.set(patient.id, patient);
  }
  for (const patient of linkedProfiles.data || []) {
    const owner = owners.get(patient.owner_profile_id);
    const ownerEmail = String(owner?.email || '');
    const safeOwnerEmail = ownerEmail.toLowerCase().endsWith('.invalid') ? '' : ownerEmail;
    const merged = { ...patient, full_name: patient.full_name || owner?.full_name, email: patient.email || safeOwnerEmail, phone: patient.phone || owner?.phone };
    if (!phoneSearch || matchesPhone(merged.phone) || profileResults.some(result => (result.data || []).some(row => row.id === patient.id))) unique.set(patient.id, merged);
  }
  const candidates = [...unique.values()];
  const candidateOwnerIds = [...new Set(candidates.map(patient => patient.owner_profile_id).filter(Boolean))];
  const archivedOwners = candidateOwnerIds.length
    ? await supabase.from('patient_profiles').select('id,email').in('id', candidateOwnerIds)
    : { data: [], error: null };
  if (archivedOwners.error) return fail('Không thể tìm hồ sơ bệnh nhân.', 503);
  const archivedOwnerIds = new Set((archivedOwners.data || [])
    .filter(owner => String(owner.email || '').toLowerCase().startsWith('archived-'))
    .map(owner => owner.id));
  return {
    ok: true,
    status: 200,
    data: candidates.filter(patient => !archivedOwnerIds.has(patient.owner_profile_id)).slice(0, 50),
  };
}

export async function listCounterSlots(user, date) {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!validDate(String(date || '')) || date < clinicDateTime().date) return fail('Ngày khám không hợp lệ hoặc đã qua.');
  const { data, error } = await supabase.from('appointment_slots')
    .select('id,slot_date,start_time,end_time,capacity,booked_count,doctors(full_name,consultation_fee),clinic_specialties(name,consultation_fee)')
    .eq('slot_date', date).eq('is_active', true).order('start_time').limit(200);
  if (error) return fail('Không thể tải khung giờ khám.', 503);
  const clinic = await getClinic();
  return { ok: true, status: 200, data: (data || []).filter(slot => slot.booked_count < slot.capacity && isFutureBooking(slot.slot_date, slot.start_time)).map(slot => {
    const consultationFee = resolveConsultationFee(slot.doctors?.consultation_fee, slot.clinic_specialties?.consultation_fee) ?? 0;
    return { ...slot, consultation_fee: consultationFee,
      deposit_amount: Math.ceil(consultationFee * Number(clinic.depositPercent || 30) / 100) };
  }) };
}

export async function createCounterBooking(user, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  const uuid = value => /^[0-9a-f-]{36}$/i.test(String(value || ''));
  if (!uuid(payload.patientId) || !uuid(payload.slotId)) return fail('Chọn bệnh nhân và khung giờ khám.');
  if (payload.reason != null && (typeof payload.reason !== 'string' || payload.reason.length > 2000)) return fail('Lý do khám tối đa 2.000 ký tự.');
  const { data, error } = await supabase.rpc('create_clinic_walkin_booking', {
    patient_id_value: payload.patientId, slot_id_value: payload.slotId,
    actor_id_value: access.data.id, cash_deposit_received: payload.cashDepositReceived === true,
    reason_value: String(payload.reason || '').trim(),
  });
  if (error) return fail(error.message, 409);
  return { ok: true, status: 201, data };
}

function validateCounterPatient(payload) {
  const fullName = String(payload.fullName || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = String(payload.phone || '').trim();
  const birthDate = String(payload.birthDate || '');
  const gender = String(payload.gender || '');
  const medicalHistory = String(payload.medicalHistory || '').trim();
  const bloodGroup = String(payload.bloodGroup || '').trim();
  const allergies = String(payload.allergies || '').trim();
  const healthInsuranceNumber = String(payload.healthInsuranceNumber || '').trim().replace(/[\s-]/g, '').toUpperCase();
  if (fullName.length < 2 || fullName.length > 120 || !/^0\d{9}$/.test(phone)
    || !validDate(birthDate) || birthDate > clinicDateTime().date
    || !['male','female','other'].includes(gender)
    || medicalHistory.length > 4000 || allergies.length > 2000
    || (bloodGroup && !['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(bloodGroup))
    || healthInsuranceNumber.length > 20 || (healthInsuranceNumber && !/^[A-Z0-9]{5,20}$/.test(healthInsuranceNumber))
    || (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))) return null;
  return { fullName, email, phone, birthDate, gender, medicalHistory, bloodGroup, allergies, healthInsuranceNumber };
}

export async function createPatientAtCounter(user, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  const data = validateCounterPatient(payload);
  if (!data) return fail('Hồ sơ bệnh nhân không hợp lệ.');
  const { data: possibleDuplicates, error: duplicateError } = await supabase
    .from('patient_medical_profiles')
    .select('id,full_name,date_of_birth')
    .eq('date_of_birth', data.birthDate)
    .limit(500);
  if (duplicateError) return fail('Không thể kiểm tra hồ sơ trùng trước khi tạo.', 503);
  const normalizeName = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
  if ((possibleDuplicates || []).some(patient => normalizeName(patient.full_name) === normalizeName(data.fullName))) {
    return fail('Đã có hồ sơ cùng họ tên và ngày sinh. Hãy tìm và chọn hồ sơ đó để tránh tạo trùng.', 409);
  }

  // Walk-in patients need a medical profile and visit, not a Firebase login.
  // The existing schema requires a unique firebase_uid and email on patient_profiles,
  // so use a non-deliverable sentinel there; the patient's actual contact email is
  // stored only on the medical profile and is optional.
  const walkInId = crypto.randomUUID();
  const ownerEmail = `walkin-${walkInId}@midhealth.invalid`;
  const { data: owner, error: ownerError } = await supabase.from('patient_profiles').insert({
    firebase_uid: `walkin-${walkInId}`,
    app_user_id: null,
    email: ownerEmail,
    full_name: data.fullName,
    phone: data.phone,
    date_of_birth: data.birthDate,
    gender: data.gender,
    role: 'patient',
    status: 'active',
    email_verified: false,
  }).select('id').single();
  if (ownerError || !owner?.id) return fail('Không thể tạo hồ sơ người bệnh tại quầy.', 503);

  const { data: patient, error: patientError } = await supabase.from('patient_medical_profiles').insert({
    owner_profile_id: owner.id,
    full_name: data.fullName,
    phone: data.phone,
    date_of_birth: data.birthDate,
    gender: data.gender,
    email: data.email || null,
    health_insurance_number: data.healthInsuranceNumber || null,
    is_primary: true,
    medical_history: data.medicalHistory || null,
    blood_group: data.bloodGroup || null,
    allergies: data.allergies || null,
  }).select('id,full_name,date_of_birth,phone,gender,email,health_insurance_number,medical_history,blood_group,allergies').single();
  if (patientError || !patient?.id) {
    await supabase.from('patient_profiles').delete().eq('id', owner.id);
    return fail('Không thể lưu hồ sơ người bệnh; chưa tạo tài khoản đăng nhập.', 503);
  }
  return { ok: true, status: 201, data: patient };
}

export async function updatePatientAtCounter(user, patientId, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.STAFF, APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(String(patientId || ''))) return fail('Mã hồ sơ không hợp lệ.');
  const data = validateCounterPatient(payload);
  if (!data) return fail('Hồ sơ bệnh nhân không hợp lệ.');
  const { data: updated, error } = await supabase.from('patient_medical_profiles').update({
    full_name: data.fullName, phone: data.phone, date_of_birth: data.birthDate, gender: data.gender,
    email: data.email || null,
    health_insurance_number: data.healthInsuranceNumber || null,
    medical_history: data.medicalHistory || null, blood_group: data.bloodGroup || null,
    allergies: data.allergies || null,
  }).eq('id', patientId).select('id,full_name,date_of_birth,phone,gender,email,health_insurance_number,medical_history,blood_group,allergies').maybeSingle();
  if (error) return fail('Không thể cập nhật hồ sơ.', 503);
  return updated ? { ok: true, status: 200, data: updated } : fail('Không tìm thấy hồ sơ.', 404);
}
