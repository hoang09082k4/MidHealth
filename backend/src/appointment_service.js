import nodemailer from 'nodemailer';
import { linkPatientProfileToAppUser, upsertAppUser } from './account_service.js';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { calculateAppointmentPrice } from './pricing.js';

const reminderEmailSent = new Set();

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

function hasMailConfig() {
  return Boolean(config.gmailUser && config.gmailAppPassword);
}

function mailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword.replace(/\s/g, ''),
    },
  });
}

function appointmentDateTime(appointment) {
  const dateValue = appointment?.appointment_date;
  const timeValue = String(appointment?.appointment_start_time || appointment?.appointment_time || '00:00').slice(0, 5);
  const value = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function appointmentMailTarget(firebaseUser, owner, appointment, input = {}) {
  return normalizeEmail(
    input?.patientProfile?.email
    || input?.email
    || appointment?.patient_medical_profiles?.email
    || owner?.email
    || firebaseUser?.email
  );
}

function appointmentMailHtml({ title, appointment, ticket, input = {}, reminder = false }) {
  const place = input.doctorName || input.facilityName || input.hospitalName || appointment.medical_facilities?.name || 'Cơ sở y tế';
  const timeText = input.time || appointment.appointment_time_text || '';
  const dateText = input.dateDisplay || toDisplayDate(appointment.appointment_date);
  const patientName = appointment.patient_name || input.patientName || '';
  const code = ticket?.appointment_code || '';
  const lead = reminder
    ? 'Lịch khám của bạn sắp diễn ra. Vui lòng đến sớm khoảng 15 phút để làm thủ tục.'
    : 'MidHealth đã ghi nhận lịch khám của bạn.';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>${title}</h2>
      <p>${lead}</p>
      <table style="border-collapse:collapse;width:100%;max-width:620px">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Mã phiếu</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>${code}</strong></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Bệnh nhân</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${patientName}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Nơi khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${place}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Ngày khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${dateText}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Giờ khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>${timeText}</strong></td></tr>
      </table>
      <p>Bạn có thể mở MidHealth để xem phiếu khám điện tử và theo dõi trạng thái lịch hẹn.</p>
    </div>
  `;
}

async function sendAppointmentEmail({ firebaseUser, owner, appointment, ticket, input = {}, reminder = false }) {
  if (!hasMailConfig()) return;
  const to = appointmentMailTarget(firebaseUser, owner, appointment, input);
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

  const subject = reminder
    ? 'MidHealth nhắc lịch khám sắp diễn ra'
    : 'MidHealth xác nhận lịch khám của bạn';

  await mailTransporter().sendMail({
    from: `"MidHealth" <${config.gmailUser}>`,
    to,
    subject,
    html: appointmentMailHtml({
      title: reminder ? 'Nhắc lịch khám' : 'Đặt lịch khám thành công',
      appointment,
      ticket,
      input,
      reminder,
    }),
  });
}

async function sendUpcomingAppointmentReminders(firebaseUser, owner, appointments = []) {
  if (!hasMailConfig()) return;
  const now = new Date();
  await Promise.all((appointments || []).map(async (appointment) => {
    const appointmentTime = appointmentDateTime(appointment);
    if (!appointmentTime) return;
    const hoursUntil = (appointmentTime.getTime() - now.getTime()) / 36e5;
    if (hoursUntil < 0 || hoursUntil > 24 || appointment.status === 'cancelled') return;
    const key = `${owner?.id || firebaseUser?.localId}:${appointment.id}`;
    if (reminderEmailSent.has(key)) return;
    reminderEmailSent.add(key);
    try {
      const ticket = Array.isArray(appointment.queue_tickets) ? appointment.queue_tickets[0] : appointment.queue_tickets;
      await sendAppointmentEmail({ firebaseUser, owner, appointment, ticket, reminder: true });
    } catch {
      reminderEmailSent.delete(key);
    }
  }));
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
  const firebaseUid = clean(firebaseUser?.localId || firebaseUser?.uid);
  if (!firebaseUid) return null;

  const lookups = [['firebase_uid', firebaseUid]];
  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('id, email')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();
  if (appUserError) throw appUserError;

  if (appUser?.id) lookups.push(['app_user_id', appUser.id]);
  const email = normalizeEmail(firebaseUser?.email || appUser?.email || '');
  if (email) lookups.push(['email', email]);

  for (const [column, value] of lookups) {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq(column, value)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) continue;

    const shouldRelink = data.firebase_uid !== firebaseUid
      || (appUser?.id && data.app_user_id !== appUser.id)
      || data.role !== 'patient'
      || data.status !== 'active';
    if (!shouldRelink) return data;

    const { data: linkedProfile, error: relinkError } = await supabase
      .from('patient_profiles')
      .update({
        firebase_uid: firebaseUid,
        app_user_id: appUser?.id || data.app_user_id || null,
        role: 'patient',
        status: 'active',
        last_login_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select()
      .single();
    if (relinkError) throw relinkError;
    return linkedProfile || data;
  }

  return null;
}

async function findExistingOwnerProfile({ firebaseUid, appUserId, email }) {
  const lookups = [
    ['firebase_uid', firebaseUid],
    ['app_user_id', appUserId],
    ['email', email],
  ].filter(([, value]) => value);

  for (const [column, value] of lookups) {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq(column, value)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
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
  if (!accountResult.ok) throw new Error(accountResult.data?.message || 'Không thể lưu tài khoản.');

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

  const existingOwner = await findExistingOwnerProfile({
    firebaseUid: firebaseUser.localId,
    appUserId: accountResult.data?.id,
    email,
  });

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
      return { ok: false, status: 400, data: { message: 'Bệnh viện không hợp lệ.' } };
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
    if (!facility) return { ok: false, status: 404, data: { message: 'Không tìm thấy bệnh viện.' } };

    const specialty = options.specialtyName ? await lookupByName('clinic_specialties', 'name', options.specialtyName) : null;
    const service = options.serviceName ? await lookupFacilityService(hospitalId, options.serviceName) : null;
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
      return { ok: false, status: 400, data: { message: 'Phòng khám không hợp lệ.' } };
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
    if (!facility) return { ok: false, status: 404, data: { message: 'Không tìm thấy phòng khám.' } };

    const specialty = options.specialtyName ? await lookupByName('clinic_specialties', 'name', options.specialtyName) : null;
    const service = options.serviceName ? await lookupFacilityService(clinicId, options.serviceName) : null;
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

export async function listDoctorSlots(doctorId, options = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    if (!isUuid(doctorId)) {
      return { ok: false, status: 400, data: { message: 'Bác sĩ không hợp lệ.' } };
    }

    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.fromDate || '')) ? options.fromDate : todayDateValue();
    const days = Math.min(Math.max(Number(options.days) || 7, 1), 14);
    const endDate = (() => {
      const date = new Date(`${fromDate}T00:00:00`);
      date.setDate(date.getDate() + days - 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();

    const data = (await fetchDoctorSlotRows(
      doctorId,
      fromDate,
      endDate,
      'id, doctor_id, slot_date, start_time, end_time, capacity, booked_count, is_active',
    )).filter((slot) => slot.is_active);

    const uniqueSlots = new Map();
    (data || [])
      .filter((slot) => (slot.booked_count || 0) < (slot.capacity || 1))
      .filter((slot) => isFutureSlotTime(slot.slot_date, slot.start_time))
      .forEach((slot) => {
        const key = `${slot.slot_date}|${formatTime(slot.start_time)}`;
        if (!uniqueSlots.has(key)) uniqueSlots.set(key, slot);
      });

    return {
      ok: true,
      status: 200,
      data: Array.from(uniqueSlots.values())
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

export async function cancelAppointmentForFailedPayment(appointmentId, paymentStatus = 'failed') {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;
  if (!isUuid(appointmentId)) {
    return { ok: false, status: 400, data: { message: 'Ma lich kham khong hop le.' } };
  }

  try {
    const { data: existing, error: lookupError } = await supabase
      .from('appointments')
      .select('id, status, payment_status, appointment_slot_id, doctor_id, facility_id, patient_name, patient_phone, appointment_date, appointment_time, appointment_time_text, queue_tickets(appointment_code, queue_number)')
      .eq('id', appointmentId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return { ok: false, status: 404, data: { message: 'Khong tim thay lich kham.' } };
    if (existing.payment_status === 'paid') {
      return { ok: false, status: 409, data: { message: 'Lich kham da thanh toan nen khong the huy tu dong.' } };
    }
    if (existing.status === 'completed') {
      return { ok: false, status: 409, data: { message: 'Lich kham da hoan tat nen khong the huy tu dong.' } };
    }

    const shouldReleaseSlot = existing.status !== 'cancelled' && existing.appointment_slot_id;
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', payment_status: paymentStatus })
      .eq('id', appointmentId)
      .neq('payment_status', 'paid')
      .select()
      .maybeSingle();
    if (error) throw error;

    await supabase
      .from('queue_tickets')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId);

    if (shouldReleaseSlot) {
      await releaseAppointmentSlot(existing.appointment_slot_id);
    }

    await logProviderAppointmentNotification({
      eventType: 'appointment_cancelled_by_payment',
      appointment: { ...existing, ...(data || {}), status: 'cancelled' },
      ticket: Array.isArray(existing.queue_tickets) ? existing.queue_tickets[0] : existing.queue_tickets,
    });

    return { ok: true, status: 200, data: data || existing };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function expireStalePendingPayments(maxAgeMinutes = Number(config.paymentPendingExpiryMinutes || 15)) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  const minutes = Math.max(Number(maxAgeMinutes) || 15, 1);
  const expiredBefore = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, appointment_id, status')
      .eq('status', 'pending')
      .lt('created_at', expiredBefore)
      .limit(50);
    if (error) throw error;

    for (const payment of payments || []) {
      if (!payment.appointment_id) continue;
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)
        .eq('status', 'pending');
      await cancelAppointmentForFailedPayment(payment.appointment_id, 'failed');
    }

    return { ok: true, status: 200, data: { expired: payments?.length || 0 } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

async function findProviderWorkspaceForAppointment(appointment = {}) {
  let query = supabase
    .from('provider_workspaces')
    .select('id, mode, provider_role, email')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (appointment.doctor_id) {
    query = query.eq('linked_doctor_id', appointment.doctor_id);
  } else if (appointment.facility_id) {
    query = query.eq('linked_facility_id', appointment.facility_id);
  } else {
    return null;
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

async function logProviderAppointmentNotification({ eventType, appointment, ticket = null, owner = null, firebaseUser = null }) {
  try {
    const workspace = await findProviderWorkspaceForAppointment(appointment);
    if (!workspace?.id) return;

    const appointmentTime = appointment.appointment_time_text || formatTime(appointment.appointment_time);
    const patientName = appointment.patient_name || '';
    const appointmentCode = ticket?.appointment_code || '';
    const eventMessages = {
      appointment_received: 'Patient booked a new appointment.',
      appointment_cancelled_by_patient: 'Patient cancelled appointment.',
      appointment_cancelled_by_payment: 'Appointment was cancelled because payment was not completed.',
    };

    await supabase
      .from('provider_workspace_events')
      .insert({
        workspace_id: workspace.id,
        actor_firebase_uid: firebaseUser?.localId || firebaseUser?.uid || null,
        actor_email: normalizeEmail(owner?.email || firebaseUser?.email || '') || null,
        actor_role: 'patient',
        event_type: eventType,
        entity_type: 'appointment',
        entity_id: appointment.id,
        message: eventMessages[eventType] || 'Appointment notification.',
        metadata: {
          appointmentId: appointment.id,
          appointmentCode,
          queueNumber: ticket?.queue_number || null,
          patientName,
          patientPhone: appointment.patient_phone || '',
          appointmentDate: appointment.appointment_date || '',
          appointmentTime,
          status: appointment.status || '',
        },
      });
  } catch {
    // Provider notifications must not block booking or cancellation.
  }
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
    const requestedType = payload.type || (payload.hospitalId || payload.facilityId ? 'hospital' : payload.clinicId ? 'clinic' : '');
    if (['hospital', 'clinic'].includes(requestedType) && !facility?.id) {
      return { ok: false, status: 404, data: { message: 'Khong tim thay co so y te de dat lich. Vui long tai lai trang va thu lai.' } };
    }

    const appointmentDate = payload.dateValue || payload.appointmentDate || payload.date;
    const appointmentTime = clean(payload.time || payload.appointmentTime);
    const parsedAppointmentTime = toTime(appointmentTime);
    const patientName = clean(payload.patientName || patient.fullName || patient.name || payload.patient);
    const hasStandardInsurance = Boolean(payload.hasStandardInsurance || payload.insuranceUsed);
    const price = calculateAppointmentPrice({
      specialtyName: payload.department || payload.specialtyName,
      hasStandardInsurance,
    });
    if (payload.finalAmount !== undefined && Math.round(Number(payload.finalAmount)) !== price.finalAmount) {
      return {
        ok: false,
        status: 409,
        data: { message: 'So tien thanh toan khong khop voi gia dat kham hien tai. Vui long tai lai trang va thu lai.' },
      };
    }
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
        .filter((slot) => doctor?.id || !facility?.id || slot.facility_id === facility.id)
        .filter((slot) => !specialty?.id || !slot.specialty_id || slot.specialty_id === specialty.id)
        .filter((slot) => !service?.id || !slot.service_id || slot.service_id === service.id)[0] || null;

      if (appointmentSlot && (appointmentSlot.booked_count || 0) >= (appointmentSlot.capacity || 1)) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay da het cho. Vui long chon khung gio khac.' } };
      }
      if (!appointmentSlot) {
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

    await logProviderAppointmentNotification({
      eventType: 'appointment_received',
      appointment,
      ticket,
      owner,
      firebaseUser,
    });

    try {
      await sendAppointmentEmail({ firebaseUser, owner, appointment, ticket, input: payload });
    } catch {
      // Email delivery must not roll back a successful appointment.
    }

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

    try {
      await sendUpcomingAppointmentReminders(firebaseUser, owner, data || []);
    } catch {
      // Listing appointments should stay reliable even if email is unavailable.
    }

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
    return { ok: false, status: 400, data: { message: 'Mã lịch khám không hợp lệ.' } };
  }

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 401, data: { message: 'Bạn cần đăng nhập để hủy lịch.' } };

    const { data: existing, error: lookupError } = await supabase
      .from('appointments')
      .select('id, status, appointment_slot_id, doctor_id, facility_id, patient_name, patient_phone, appointment_date, appointment_time, appointment_time_text, queue_tickets(appointment_code, queue_number)')
      .eq('id', appointmentId)
      .eq('owner_profile_id', owner.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
    }
    if (existing.status === 'cancelled') {
      return { ok: true, status: 200, data: existing };
    }
    if (existing.status === 'completed') {
      return { ok: false, status: 409, data: { message: 'Lịch khám đã hoàn tất nên không thể hủy.' } };
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

    await logProviderAppointmentNotification({
      eventType: 'appointment_cancelled_by_patient',
      appointment: { ...existing, ...data, status: 'cancelled' },
      ticket: Array.isArray(existing.queue_tickets) ? existing.queue_tickets[0] : existing.queue_tickets,
      owner,
      firebaseUser,
    });

    return { ok: true, status: 200, data };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
