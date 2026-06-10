import { linkPatientProfileToAppUser, upsertAppUser } from './account_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { calculateAppointmentPrice } from './pricing.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return clean(email).toLowerCase();
}

function mapGender(gender) {
  if (gender === 'Nam' || gender === 'male') return 'male';
  if (gender === 'Nữ' || gender === 'female') return 'female';
  return 'other';
}

function toDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function toTime(value) {
  const match = String(value || '').match(/(\d{2}:\d{2})/);
  return match ? `${match[1]}:00` : null;
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function toDisplayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isFutureSlotTime(dateValue, timeValue) {
  const today = todayDateValue();
  if (String(dateValue) < today) return false;
  if (String(dateValue) > today) return true;
  return formatTime(timeValue) > currentTimeValue();
}

function stripAssetPrefix(value = '') {
  return String(value || '').replace(/^\/(?:image_doctor|image_benh_vien|image_phong_kham)\//, '');
}

function ticketCode(number) {
  return `MH-${String(1000 + number).slice(-4)}`;
}

function appointmentCode(number) {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `YMA${y}${m}${d}${String(50000 + number).padStart(5, '0')}`;
}

function patientCode(number) {
  return `YMP${String(2628000000 + number)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function isDuplicateKeyError(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message || '');
}

async function requireSupabase() {
  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình Supabase.' },
    };
  }
  return { ok: true };
}

export async function findOwnerProfile(firebaseUser) {
  if (!firebaseUser?.localId) return null;
  const query = supabase
    .from('patient_profiles')
    .select('*')
    .eq('firebase_uid', firebaseUser.localId);

  const { data, error } = await query
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureOwnerProfile(firebaseUser, profile = {}) {
  const existing = await findOwnerProfile(firebaseUser);
  if (existing) return existing;
  if (!firebaseUser?.localId) return null;

  const email = normalizeEmail(profile.email || firebaseUser.email || `${firebaseUser.localId}@midhealth.local`);
  const fullName = clean(profile.fullName || profile.name) || clean(firebaseUser.displayName) || 'MidHealth User';
  const phone = clean(profile.phone) || '0000000000';
  const dateOfBirth = toDate(profile.dateOfBirth || profile.birthDate) || '1900-01-01';
  const accountResult = await upsertAppUser(firebaseUser, {
    fullName,
    email,
    emailVerified: Boolean(firebaseUser.email || profile.email),
    markLogin: true,
    allowPatientIdentityRelink: true,
  });
  if (!accountResult.ok) throw new Error(accountResult.data?.message || 'Khong the luu tai khoan.');

  const ownerRow = {
    firebase_uid: firebaseUser.localId,
    app_user_id: accountResult.data?.id || null,
    email,
    full_name: fullName,
    phone,
    date_of_birth: dateOfBirth,
    gender: mapGender(profile.gender),
    citizen_id: clean(profile.citizenId) || null,
    health_insurance_number: clean(profile.healthInsuranceNumber || profile.insuranceCode) || null,
    province: clean(profile.province) || null,
    district: clean(profile.district) || null,
    ward: clean(profile.ward) || null,
    address: clean(profile.address) || null,
    ethnicity: clean(profile.ethnicity) || 'Kinh',
    occupation: clean(profile.occupation || profile.job) || null,
    role: 'patient',
    status: 'active',
    email_verified: Boolean(firebaseUser.email || profile.email),
    last_login_at: new Date().toISOString(),
  };

  const { data: existingOwner, error: lookupError } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('firebase_uid', firebaseUser.localId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { data, error } = existingOwner?.id
    ? await supabase
      .from('patient_profiles')
      .update(ownerRow)
      .eq('id', existingOwner.id)
      .select()
      .single()
    : await supabase
      .from('patient_profiles')
      .insert(ownerRow)
      .select()
      .single();

  if (error) throw error;
  await linkPatientProfileToAppUser(firebaseUser.localId, accountResult.data?.id);

  return data || null;
}

export async function listPatientProfiles(firebaseUser) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: true, status: 200, data: [] };

    const { data, error } = await supabase
      .from('patient_medical_profiles')
      .select('*, patient_guardians(*)')
      .eq('owner_profile_id', owner.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { ok: true, status: 200, data: data || [] };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function saveMedicalProfile(firebaseUser, payload = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const profile = payload.profile || payload;
    const owner = await ensureOwnerProfile(firebaseUser, profile);
    if (!owner) {
      return { ok: false, status: 401, data: { message: 'Chưa có hồ sơ tài khoản để lưu hồ sơ bệnh nhân.' } };
    }

    const row = {
      owner_profile_id: owner.id,
      relationship: clean(profile.relationship) || 'Tôi',
      full_name: clean(profile.fullName || profile.name),
      phone: clean(profile.phone),
      date_of_birth: toDate(profile.dateOfBirth || profile.birthDate),
      gender: mapGender(profile.gender),
      citizen_id: clean(profile.citizenId) || null,
      health_insurance_number: clean(profile.healthInsuranceNumber || profile.insuranceCode) || null,
      email: clean(profile.email) || owner.email,
      province: clean(profile.province) || null,
      district: clean(profile.district) || null,
      ward: clean(profile.ward) || null,
      address: clean(profile.address) || null,
      ethnicity: clean(profile.ethnicity) || 'Kinh',
      occupation: clean(profile.occupation || profile.job) || null,
      is_primary: Boolean(profile.isPrimary || profile.isMain || profile.relationship === 'Tôi'),
    };

    if (!row.full_name || !row.phone || !row.date_of_birth) {
      return { ok: false, status: 400, data: { message: 'Thiếu họ tên, số điện thoại hoặc ngày sinh.' } };
    }

    const profileId = isUuid(profile.id) ? profile.id : null;
    const query = supabase.from('patient_medical_profiles');
    const { data, error } = profileId
      ? await query.update(row).eq('id', profileId).eq('owner_profile_id', owner.id).select().single()
      : await query.insert(row).select().single();

    if (error) throw error;

    if (Array.isArray(profile.guardians)) {
      await supabase.from('patient_guardians').delete().eq('patient_medical_profile_id', data.id);
      const guardians = profile.guardians
        .filter((guardian) => clean(guardian.name) && clean(guardian.phone))
        .map((guardian) => ({
          patient_medical_profile_id: data.id,
          relationship: clean(guardian.relationship) || 'Khác',
          full_name: clean(guardian.name),
          phone: clean(guardian.phone),
          citizen_id: clean(guardian.citizenId) || null,
          email: clean(guardian.email) || null,
        }));
      if (guardians.length) await supabase.from('patient_guardians').insert(guardians);
    }

    return { ok: true, status: profileId ? 200 : 201, data };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

async function lookupByName(table, nameColumn, name) {
  if (!name) return null;
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(nameColumn, name)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function lookupFacilityService(facilityId, name) {
  if (!facilityId || !name) return null;
  const { data, error } = await supabase
    .from('facility_services')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('name', name)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function lookupFacility(payload = {}) {
  const facilityId = payload.facilityId || payload.hospitalId || payload.clinicId;
  if (isUuid(facilityId)) {
    const { data, error } = await supabase
      .from('medical_facilities')
      .select('*')
      .eq('id', facilityId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const facilityName = payload.facilityName || payload.hospitalName || payload.clinicName;
  return facilityName ? lookupByName('medical_facilities', 'name', facilityName) : null;
}

async function lookupDoctor(payload = {}) {
  if (isUuid(payload.doctorId)) {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', payload.doctorId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  return payload.doctorName ? lookupByName('doctors', 'full_name', payload.doctorName) : null;
}

function addMinutes(time, minutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes, 0);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function futureDateValue(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDoctorWorkingTime(time) {
  const value = formatTime(time);
  return (value >= '07:30' && value < '11:30') || (value >= '13:30' && value < '17:00') || (value >= '17:30' && value < '19:00');
}

function doctorScheduleSeed(doctorId = '') {
  return String(doctorId).split('').reduce((total, char) => total + char.charCodeAt(0), 0);
}

function buildNaturalSlotTimes(doctorId, dateValueText) {
  const seed = doctorScheduleSeed(`${doctorId}-${dateValueText}`);
  const date = new Date(`${dateValueText}T00:00:00`);
  const day = date.getDay();
  if ((seed + day) % 9 === 0) return [];

  const morningPool = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];
  const afternoonPool = ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const eveningPool = ['17:30', '18:00', '18:30'];
  const useMorning = day !== 0 && seed % 3 !== 0;
  const useAfternoon = day !== 6 || seed % 2 === 0;
  const useEvening = seed % 5 === 0;
  const slots = [];

  const takeSlots = (pool, count, offset) => pool.filter((_, index) => (index + offset) % 2 === 0).slice(0, count);
  if (useMorning) slots.push(...takeSlots(morningPool, 4 + (seed % 2), seed));
  if (useAfternoon) slots.push(...takeSlots(afternoonPool, 4 + (seed % 3), seed + 1));
  if (useEvening) slots.push(...eveningPool.slice(0, 2));

  return slots.slice(0, 12).map((start) => ({
    start_time: `${start}:00`,
    end_time: addMinutes(`${start}:00`, 15),
  }));
}

async function ensureFutureDoctorSlots(doctorId, fromDate, days) {
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, facility_id, specialty_id, is_active')
    .eq('id', doctorId)
    .eq('is_active', true)
    .maybeSingle();
  if (doctorError) throw doctorError;
  if (!doctor) return;

  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(fromDate)) && String(fromDate) >= todayDateValue()
    ? String(fromDate)
    : todayDateValue();
  const base = new Date(`${from}T00:00:00`);
  const dates = Array.from({ length: Math.min(Math.max(Number(days) || 7, 1), 14) }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const rows = [];

  await cleanupDuplicateDoctorSlots(doctor.id, dates[0], dates[dates.length - 1]);
  const existing = await fetchDoctorSlotRows(doctor.id, dates[0], dates[dates.length - 1], 'slot_date, start_time');
  const existingKeys = new Set((existing || []).map((slot) => `${slot.slot_date}|${formatTime(slot.start_time)}`));
  dates.forEach((slot_date) => {
    buildNaturalSlotTimes(doctor.id, slot_date).forEach(({ start_time, end_time }) => {
      const key = `${slot_date}|${formatTime(start_time)}`;
      if (existingKeys.has(key)) return;
      rows.push({
        facility_id: doctor.facility_id,
        doctor_id: doctor.id,
        specialty_id: doctor.specialty_id,
        slot_date,
        start_time,
        end_time,
        capacity: 1,
        booked_count: 0,
        is_active: true,
      });
    });
  });

  if (!rows.length) return;
  const { error } = await supabase.from('appointment_slots').insert(rows);
  if (error && !isDuplicateKeyError(error)) throw error;
}

async function ensureFutureHospitalSlots(facilityId, options = {}) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) && String(options.fromDate) >= todayDateValue()
    ? String(options.fromDate)
    : todayDateValue();
  const days = Math.min(Math.max(Number(options.days) || 31, 1), 62);
  const base = new Date(`${from}T00:00:00`);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });

  const times = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
  const rows = [];
  const existing = await fetchHospitalSlotRows(facilityId, dates[0], dates[dates.length - 1], 'slot_date, start_time, specialty_id, service_id');
  const existingKeys = new Set((existing || []).map((slot) => [
    slot.slot_date,
    formatTime(slot.start_time),
    slot.specialty_id || '',
    slot.service_id || '',
  ].join('|')));

  dates.forEach((slotDate) => {
    const day = new Date(`${slotDate}T00:00:00`).getDay();
    if (day === 0) return;
    times.forEach((start) => {
      const key = [slotDate, start, options.specialtyId || '', options.serviceId || ''].join('|');
      if (existingKeys.has(key)) return;
      rows.push({
        facility_id: facilityId,
        specialty_id: options.specialtyId || null,
        service_id: options.serviceId || null,
        slot_date: slotDate,
        start_time: `${start}:00`,
        end_time: addMinutes(`${start}:00`, 30),
        capacity: 8,
        booked_count: 0,
        is_active: true,
      });
    });
  });

  if (!rows.length) return;
  const { error } = await supabase.from('appointment_slots').insert(rows);
  if (error && !isDuplicateKeyError(error)) throw error;
}

async function ensureFutureClinicSlots(facilityId, options = {}) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) && String(options.fromDate) >= todayDateValue()
    ? String(options.fromDate)
    : todayDateValue();
  const days = Math.min(Math.max(Number(options.days) || 31, 1), 62);
  const base = new Date(`${from}T00:00:00`);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });

  const times = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00', '17:30', '18:00', '18:30'];
  const rows = [];
  const existing = await fetchHospitalSlotRows(facilityId, dates[0], dates[dates.length - 1], 'slot_date, start_time, specialty_id, service_id');
  const existingKeys = new Set((existing || []).map((slot) => [
    slot.slot_date,
    formatTime(slot.start_time),
    slot.specialty_id || '',
    slot.service_id || '',
  ].join('|')));

  dates.forEach((slotDate) => {
    const day = new Date(`${slotDate}T00:00:00`).getDay();
    if (day === 0) return;
    times.forEach((start) => {
      const key = [slotDate, start, options.specialtyId || '', options.serviceId || ''].join('|');
      if (existingKeys.has(key)) return;
      rows.push({
        facility_id: facilityId,
        specialty_id: options.specialtyId || null,
        service_id: options.serviceId || null,
        slot_date: slotDate,
        start_time: `${start}:00`,
        end_time: addMinutes(`${start}:00`, 30),
        capacity: 4,
        booked_count: 0,
        is_active: true,
      });
    });
  });

  if (!rows.length) return;
  const { error } = await supabase.from('appointment_slots').insert(rows);
  if (error && !isDuplicateKeyError(error)) throw error;
}

async function fetchHospitalSlotRows(facilityId, fromDate, toDate, columns) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('appointment_slots')
      .select(columns)
      .eq('facility_id', facilityId)
      .is('doctor_id', null)
      .gte('slot_date', fromDate)
      .lte('slot_date', toDate)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function listHospitalSlots(hospitalId, options = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    if (!isUuid(hospitalId)) {
      return { ok: false, status: 400, data: { message: 'Benh vien khong hop le.' } };
    }

    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) ? options.fromDate : todayDateValue();
    const days = Math.min(Math.max(Number(options.days) || 31, 1), 62);
    const endDate = (() => {
      const date = new Date(`${fromDate}T00:00:00`);
      date.setDate(date.getDate() + days - 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();

    const { data: facility, error: facilityError } = await supabase
      .from('medical_facilities')
      .select('id, type, is_active')
      .eq('id', hospitalId)
      .eq('type', 'hospital')
      .eq('is_active', true)
      .maybeSingle();
    if (facilityError) throw facilityError;
    if (!facility) return { ok: false, status: 404, data: { message: 'Khong tim thay benh vien.' } };

    const specialty = options.specialtyName ? await lookupByName('clinic_specialties', 'name', options.specialtyName) : null;
    const service = options.serviceName ? await lookupFacilityService(hospitalId, options.serviceName) : null;
    await ensureFutureHospitalSlots(hospitalId, {
      fromDate,
      days,
      specialtyId: specialty?.id || null,
      serviceId: service?.id || null,
    });

    const rows = await fetchHospitalSlotRows(
      hospitalId,
      fromDate,
      endDate,
      'id, facility_id, specialty_id, service_id, slot_date, start_time, end_time, capacity, booked_count, is_active',
    );

    const slots = (rows || [])
      .filter((slot) => slot.is_active)
      .filter((slot) => !specialty?.id || !slot.specialty_id || slot.specialty_id === specialty.id)
      .filter((slot) => !service?.id || !slot.service_id || slot.service_id === service.id)
      .filter((slot) => isFutureSlotTime(slot.slot_date, slot.start_time));

    return {
      ok: true,
      status: 200,
      data: slots.map((slot) => ({
        id: slot.id,
        hospitalId: slot.facility_id,
        serviceId: slot.service_id,
        specialtyId: slot.specialty_id,
        date: slot.slot_date,
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`,
        session: formatTime(slot.start_time) < '12:00' ? 'morning' : 'afternoon',
        capacity: slot.capacity,
        bookedCount: slot.booked_count,
        status: (slot.booked_count || 0) >= (slot.capacity || 1) ? 'full' : 'available',
      })),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function listClinicSlots(clinicId, options = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    if (!isUuid(clinicId)) {
      return { ok: false, status: 400, data: { message: 'Phong kham khong hop le.' } };
    }

    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) ? options.fromDate : todayDateValue();
    const days = Math.min(Math.max(Number(options.days) || 31, 1), 62);
    const endDate = (() => {
      const date = new Date(`${fromDate}T00:00:00`);
      date.setDate(date.getDate() + days - 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();

    const { data: facility, error: facilityError } = await supabase
      .from('medical_facilities')
      .select('id, type, is_active')
      .eq('id', clinicId)
      .eq('type', 'clinic')
      .eq('is_active', true)
      .maybeSingle();
    if (facilityError) throw facilityError;
    if (!facility) return { ok: false, status: 404, data: { message: 'Khong tim thay phong kham.' } };

    const specialty = options.specialtyName ? await lookupByName('clinic_specialties', 'name', options.specialtyName) : null;
    const service = options.serviceName ? await lookupFacilityService(clinicId, options.serviceName) : null;
    await ensureFutureClinicSlots(clinicId, {
      fromDate,
      days,
      specialtyId: specialty?.id || null,
      serviceId: service?.id || null,
    });

    const rows = await fetchHospitalSlotRows(
      clinicId,
      fromDate,
      endDate,
      'id, facility_id, specialty_id, service_id, slot_date, start_time, end_time, capacity, booked_count, is_active',
    );

    const slots = (rows || [])
      .filter((slot) => slot.is_active)
      .filter((slot) => !specialty?.id || !slot.specialty_id || slot.specialty_id === specialty.id)
      .filter((slot) => !service?.id || !slot.service_id || slot.service_id === service.id)
      .filter((slot) => isFutureSlotTime(slot.slot_date, slot.start_time));

    return {
      ok: true,
      status: 200,
      data: slots.map((slot) => ({
        id: slot.id,
        clinicId: slot.facility_id,
        serviceId: slot.service_id,
        specialtyId: slot.specialty_id,
        date: slot.slot_date,
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`,
        session: formatTime(slot.start_time) < '12:00' ? 'morning' : 'afternoon',
        capacity: slot.capacity,
        bookedCount: slot.booked_count,
        status: (slot.booked_count || 0) >= (slot.capacity || 1) ? 'full' : 'available',
      })),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

async function fetchDoctorSlotRows(doctorId, fromDate, toDate, columns) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('appointment_slots')
      .select(columns)
      .eq('doctor_id', doctorId)
      .gte('slot_date', fromDate)
      .lte('slot_date', toDate)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function cleanupDuplicateDoctorSlots(doctorId, fromDate, toDate) {
  const slots = await fetchDoctorSlotRows(doctorId, fromDate, toDate, 'id, slot_date, start_time, booked_count, created_at');
  const byTime = new Map();

  slots.forEach((slot) => {
    const key = `${slot.slot_date}|${formatTime(slot.start_time)}`;
    const current = byTime.get(key) || [];
    current.push(slot);
    byTime.set(key, current);
  });

  const duplicateIds = [];
  byTime.forEach((items) => {
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => {
      if ((b.booked_count || 0) !== (a.booked_count || 0)) return (b.booked_count || 0) - (a.booked_count || 0);
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
    sorted.slice(1).forEach((slot) => {
      if ((slot.booked_count || 0) === 0) duplicateIds.push(slot.id);
    });
  });

  for (let index = 0; index < duplicateIds.length; index += 200) {
    const chunk = duplicateIds.slice(index, index + 200);
    const { error } = await supabase.from('appointment_slots').delete().in('id', chunk);
    if (error) throw error;
  }
}

export async function listDoctorSlots(doctorId, options = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    if (!isUuid(doctorId)) {
      return { ok: false, status: 400, data: { message: 'Bac si khong hop le.' } };
    }

    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) ? options.fromDate : todayDateValue();
    const days = Math.min(Math.max(Number(options.days) || 7, 1), 14);
    const endDate = (() => {
      const date = new Date(`${fromDate}T00:00:00`);
      date.setDate(date.getDate() + days - 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();

    await ensureFutureDoctorSlots(doctorId, fromDate, days);

    const data = (await fetchDoctorSlotRows(
      doctorId,
      fromDate,
      endDate,
      'id, doctor_id, slot_date, start_time, end_time, capacity, booked_count, is_active',
    )).filter((slot) => slot.is_active);

    const uniqueSlots = new Map();
    (data || [])
      .filter((slot) => (slot.booked_count || 0) < (slot.capacity || 1))
      .filter((slot) => isDoctorWorkingTime(slot.start_time))
      .filter((slot) => isFutureSlotTime(slot.slot_date, slot.start_time))
      .forEach((slot) => {
        const key = `${slot.slot_date}|${formatTime(slot.start_time)}`;
        if (!uniqueSlots.has(key)) uniqueSlots.set(key, slot);
      });

    const compactByDate = new Map();
    Array.from(uniqueSlots.values()).forEach((slot) => {
      const current = compactByDate.get(slot.slot_date) || [];
      if (current.length < 12) current.push(slot);
      compactByDate.set(slot.slot_date, current);
    });

    return {
      ok: true,
      status: 200,
      data: Array.from(compactByDate.values()).flat()
        .map((slot) => ({
          id: slot.id,
          doctorId: slot.doctor_id,
          date: slot.slot_date,
          startTime: formatTime(slot.start_time),
          endTime: formatTime(slot.end_time),
          label: `${formatTime(slot.start_time)}-${formatTime(slot.end_time)}`,
          session: formatTime(slot.start_time) < '12:00' ? 'morning' : 'afternoon',
          capacity: slot.capacity,
          bookedCount: slot.booked_count,
        })),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

async function nextQueueNumber() {
  const { data, error } = await supabase
    .from('queue_tickets')
    .select('queue_number')
    .order('queue_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.queue_number || 0) + 1;
}

async function claimAppointmentSlot(slotId) {
  if (!slotId) return null;

  const { data, error } = await supabase.rpc('claim_appointment_slot', { slot_id: slotId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

async function releaseAppointmentSlot(slotId) {
  if (!slotId) return;
  const { error } = await supabase.rpc('release_appointment_slot', { slot_id: slotId });
  if (error) throw error;
}

function mapAppointmentResponse(appointment, ticket, input = {}) {
  const doctorName = input.doctorName || appointment.doctors?.full_name || input.facilityName || input.hospitalName || appointment.medical_facilities?.name || 'Đang cập nhật';
  const facilityName = input.hospitalName || input.facilityName || appointment.medical_facilities?.name || '';
  const specialtyName = input.department || input.specialtyName || appointment.clinic_specialties?.name || '';
  const serviceName = input.serviceName || appointment.facility_services?.name || '';
  const attachments = input.attachments || appointment.appointment_attachments?.map((file) => file.file_name) || [];

  return {
    id: appointment.id,
    type: appointment.appointment_type,
    status: ticket?.status === 'cancelled' || appointment.status === 'cancelled'
      ? 'Đã hủy'
      : appointment.status === 'completed'
        ? 'Đã khám'
        : 'Đã đặt lịch',
    ticket: ticket?.ticket_code,
    appointmentCode: ticket?.appointment_code,
    patientCode: ticket?.patient_code,
    number: ticket?.queue_number,
    doctorName,
    doctorShortName: input.doctorShortName || doctorName,
    doctorImage: input.doctorImage || stripAssetPrefix(appointment.doctors?.avatar_url || appointment.medical_facilities?.avatar_url || ''),
    department: specialtyName,
    serviceName,
    hospitalName: facilityName,
    address: input.address || appointment.medical_facilities?.address || '',
    dateDisplay: input.dateDisplay || toDisplayDate(appointment.appointment_date),
    dateValue: appointment.appointment_date,
    time: input.time || appointment.appointment_time_text || '',
    patientName: appointment.patient_name,
    birthDate: input.birthDate || toDisplayDate(appointment.patient_medical_profiles?.date_of_birth) || '',
    gender: input.gender || (appointment.patient_medical_profiles?.gender === 'female' ? 'Nữ' : appointment.patient_medical_profiles?.gender === 'male' ? 'Nam' : ''),
    phone: appointment.patient_phone || '',
    patientAddress: input.patientAddress || [
      appointment.patient_medical_profiles?.address,
      appointment.patient_medical_profiles?.ward,
      appointment.patient_medical_profiles?.district,
      appointment.patient_medical_profiles?.province,
    ].filter(Boolean).join(', '),
    patientProfile: input.patientProfile || (appointment.patient_medical_profiles ? {
      id: appointment.patient_medical_profiles.id,
      fullName: appointment.patient_medical_profiles.full_name,
      name: appointment.patient_medical_profiles.full_name,
      birthDate: toDisplayDate(appointment.patient_medical_profiles.date_of_birth),
      phone: appointment.patient_medical_profiles.phone,
      gender: appointment.patient_medical_profiles.gender === 'female' ? 'Nữ' : appointment.patient_medical_profiles.gender === 'male' ? 'Nam' : '',
      citizenId: appointment.patient_medical_profiles.citizen_id || '',
      email: appointment.patient_medical_profiles.email || '',
      province: appointment.patient_medical_profiles.province || '',
      district: appointment.patient_medical_profiles.district || '',
      ward: appointment.patient_medical_profiles.ward || '',
      address: appointment.patient_medical_profiles.address || '',
      ethnicity: appointment.patient_medical_profiles.ethnicity || '',
      job: appointment.patient_medical_profiles.occupation || '',
      insuranceCode: appointment.patient_medical_profiles.health_insurance_number || '',
      relationship: appointment.patient_medical_profiles.relationship || '',
    } : null),
    note: appointment.note || '',
    attachments,
    insuranceUsed: Boolean(appointment.insurance_used ?? input.insuranceUsed),
    insuranceType: appointment.insurance_type || input.insuranceType || '',
    originalAmount: Number(appointment.original_amount ?? input.originalAmount ?? 0),
    insuranceDiscount: Number(appointment.insurance_discount ?? input.insuranceDiscount ?? 0),
    finalAmount: Number(appointment.final_amount ?? input.finalAmount ?? 0),
    paymentStatus: appointment.payment_status || input.paymentStatus || 'unpaid',
  };
}

export async function createAppointment(firebaseUser, payload = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  let claimedSlotId = null;
  let insertedAppointmentId = null;

  try {
    const patient = payload.patientProfile || payload.patient || {};
    const doctor = await lookupDoctor(payload);
    const facility = await lookupFacility(payload);
    const specialty = payload.department || payload.specialtyName
      ? await lookupByName('clinic_specialties', 'name', payload.department || payload.specialtyName)
      : null;
    const service = facility?.id && payload.serviceName
      ? await lookupFacilityService(facility.id, payload.serviceName)
      : null;

    const appointmentDate = payload.dateValue || payload.appointmentDate || payload.date;
    const appointmentTime = clean(payload.time || payload.appointmentTime);
    const parsedAppointmentTime = toTime(appointmentTime);
    const patientName = clean(payload.patientName || patient.fullName || patient.name || payload.patient);
    const hasStandardInsurance = Boolean(payload.hasStandardInsurance || payload.insuranceUsed);
    const price = calculateAppointmentPrice({
      specialtyName: payload.department || payload.specialtyName,
      hasStandardInsurance,
    });
    if (!appointmentDate || !appointmentTime || !parsedAppointmentTime || !patientName) {
      return { ok: false, status: 400, data: { message: 'Thiếu ngày khám, giờ khám hoặc tên bệnh nhân.' } };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate)) || String(appointmentDate) < todayDateValue()) {
      return { ok: false, status: 400, data: { message: 'Ngày khám không hợp lệ hoặc đã qua.' } };
    }
    if (!isFutureSlotTime(appointmentDate, parsedAppointmentTime)) {
      return { ok: false, status: 400, data: { message: 'Khung giờ này đã qua. Vui lòng chọn khung giờ khác.' } };
    }
    const owner = await ensureOwnerProfile(firebaseUser, {
      ...patient,
      name: patientName,
      phone: clean(payload.phone || patient.phone),
      birthDate: patient.birthDate || payload.birthDate,
      gender: patient.gender || payload.gender,
    });

    let appointmentSlot = null;
    if (doctor?.id || facility?.id) {
      if (doctor?.id) {
        await ensureFutureDoctorSlots(doctor.id, appointmentDate, 1);
      } else if (facility?.type === 'hospital') {
        await ensureFutureHospitalSlots(facility.id, {
          fromDate: appointmentDate,
          days: 1,
          specialtyId: specialty?.id || null,
          serviceId: service?.id || null,
        });
      } else if (facility?.type === 'clinic') {
        await ensureFutureClinicSlots(facility.id, {
          fromDate: appointmentDate,
          days: 1,
          specialtyId: specialty?.id || null,
          serviceId: service?.id || null,
        });
      }

      let slots = [];
      let slotError = null;

      if (payload.appointmentSlotId && isUuid(payload.appointmentSlotId)) {
        const result = await supabase
          .from('appointment_slots')
          .select('*')
          .eq('id', payload.appointmentSlotId)
          .eq('slot_date', appointmentDate)
          .eq('start_time', parsedAppointmentTime)
          .eq('is_active', true)
          .limit(1);
        slots = result.data || [];
        slotError = result.error;
      } else {
        let slotQuery = supabase
          .from('appointment_slots')
          .select('*')
          .eq('slot_date', appointmentDate)
          .eq('start_time', parsedAppointmentTime)
          .eq('is_active', true)
          .limit(1);

        if (doctor?.id) {
          slotQuery = slotQuery.eq('doctor_id', doctor.id);
        } else {
          slotQuery = slotQuery.eq('facility_id', facility.id).is('doctor_id', null);
        }

        const result = await slotQuery;
        slots = result.data || [];
        slotError = result.error;
      }

      if (slotError) throw slotError;
      appointmentSlot = (slots || [])
        .filter((slot) => !doctor?.id || slot.doctor_id === doctor.id)
        .filter((slot) => doctor?.id || slot.facility_id === facility.id)
        .filter((slot) => !specialty?.id || !slot.specialty_id || slot.specialty_id === specialty.id)
        .filter((slot) => !service?.id || !slot.service_id || slot.service_id === service.id)[0] || null;

      if (appointmentSlot && (appointmentSlot.booked_count || 0) >= (appointmentSlot.capacity || 1)) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay da het cho. Vui long chon khung gio khac.' } };
      }
      if (!appointmentSlot && ['hospital', 'clinic'].includes(facility?.type)) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay khong con kha dung. Vui long chon khung gio khac.' } };
      }
    }

    if (appointmentSlot?.id) {
      const claimedSlot = await claimAppointmentSlot(appointmentSlot.id);
      if (!claimedSlot) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay da het cho. Vui long chon khung gio khac.' } };
      }
      claimedSlotId = appointmentSlot.id;
      appointmentSlot = { ...appointmentSlot, ...claimedSlot };
    }

    const appointmentRow = {
      owner_profile_id: owner?.id || null,
      patient_medical_profile_id: isUuid(patient.id) ? patient.id : null,
      appointment_slot_id: appointmentSlot?.id || null,
      appointment_type: payload.type || (doctor ? 'doctor' : facility?.type === 'clinic' ? 'clinic' : 'hospital'),
      facility_id: facility?.id || doctor?.facility_id || null,
      doctor_id: doctor?.id || null,
      specialty_id: specialty?.id || doctor?.specialty_id || null,
      service_id: service?.id || null,
      appointment_date: appointmentDate,
      appointment_time: parsedAppointmentTime,
      appointment_start_time: parsedAppointmentTime,
      appointment_end_time: toTime(payload.endTime) || appointmentSlot?.end_time || null,
      appointment_time_text: appointmentTime,
      patient_name: patientName,
      patient_phone: clean(payload.phone || patient.phone) || null,
      reason: clean(payload.reason) || null,
      note: clean(payload.note) || null,
      status: 'confirmed',
      insurance_used: hasStandardInsurance,
      insurance_type: hasStandardInsurance ? 'BHYT thường' : null,
      insurance_rate: price.insuranceRate,
      original_amount: price.originalAmount,
      insurance_discount: price.insuranceDiscount,
      final_amount: price.finalAmount,
      payment_status: price.finalAmount > 0 ? 'unpaid' : 'paid',
    };

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentRow)
      .select()
      .single();
    if (appointmentError) throw appointmentError;
    insertedAppointmentId = appointment.id;

    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (attachments.length) {
      await supabase.from('appointment_attachments').insert(attachments.map((fileName) => ({
        appointment_id: appointment.id,
        file_name: String(fileName),
      })));
    }

    const number = await nextQueueNumber();
    const ticketRow = {
      appointment_id: appointment.id,
      owner_profile_id: owner?.id || null,
      patient_medical_profile_id: isUuid(patient.id) ? patient.id : null,
      ticket_code: ticketCode(number),
      appointment_code: appointmentCode(number),
      patient_code: patientCode(number),
      queue_number: number,
      current_number: Math.max(number - 6, 1),
      room: clean(payload.room) || 'Đang cập nhật',
      status: 'waiting',
      estimated_minutes: 15,
    };

    const { data: ticket, error: ticketError } = await supabase
      .from('queue_tickets')
      .insert(ticketRow)
      .select()
      .single();
    if (ticketError) throw ticketError;

    return {
      ok: true,
      status: 201,
      data: mapAppointmentResponse(appointment, ticket, {
        ...payload,
        insuranceUsed: hasStandardInsurance,
        insuranceType: hasStandardInsurance ? 'BHYT thường' : '',
        originalAmount: price.originalAmount,
        insuranceDiscount: price.insuranceDiscount,
        finalAmount: price.finalAmount,
        paymentStatus: price.finalAmount > 0 ? 'unpaid' : 'paid',
      }),
    };
  } catch (error) {
    try {
      if (insertedAppointmentId) {
        await supabase.from('appointments').delete().eq('id', insertedAppointmentId);
      }
      if (claimedSlotId) {
        await releaseAppointmentSlot(claimedSlotId);
      }
    } catch {
      // Keep the original booking error visible to the caller.
    }
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function listAppointments(firebaseUser) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: true, status: 200, data: [] };

    const { data, error } = await supabase
      .from('appointments')
      .select('*, queue_tickets(*), appointment_attachments(file_name), doctors(full_name, avatar_url), medical_facilities(name, address, avatar_url), clinic_specialties(name), facility_services(name), patient_medical_profiles(*)')
      .eq('owner_profile_id', owner.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return {
      ok: true,
      status: 200,
      data: (data || []).map((appointment) => mapAppointmentResponse(
        appointment,
        Array.isArray(appointment.queue_tickets) ? appointment.queue_tickets[0] : appointment.queue_tickets,
      )),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function cancelAppointment(firebaseUser, appointmentId) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;
  if (!isUuid(appointmentId)) {
    return { ok: false, status: 400, data: { message: 'Ma lich kham khong hop le.' } };
  }

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 401, data: { message: 'Bạn cần đăng nhập để hủy lịch.' } };

    const { data: existing, error: lookupError } = await supabase
      .from('appointments')
      .select('id, status, appointment_slot_id')
      .eq('id', appointmentId)
      .eq('owner_profile_id', owner.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      return { ok: false, status: 404, data: { message: 'Khong tim thay lich kham.' } };
    }
    if (existing.status === 'cancelled') {
      return { ok: true, status: 200, data: existing };
    }
    if (existing.status === 'completed') {
      return { ok: false, status: 409, data: { message: 'Lich kham da hoan tat nen khong the huy.' } };
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('owner_profile_id', owner.id)
      .eq('status', existing.status)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: current, error: currentError } = await supabase
        .from('appointments')
        .select('id, status, appointment_slot_id')
        .eq('id', appointmentId)
        .eq('owner_profile_id', owner.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (current?.status === 'cancelled') {
        return { ok: true, status: 200, data: current };
      }
      return { ok: false, status: 409, data: { message: 'Trang thai lich kham da thay doi. Vui long tai lai.' } };
    }

    const { error: ticketError } = await supabase
      .from('queue_tickets')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId);
    if (ticketError) throw ticketError;

    if (data.appointment_slot_id) {
      await releaseAppointmentSlot(data.appointment_slot_id);
    }

    return { ok: true, status: 200, data };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
