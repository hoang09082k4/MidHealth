import { logAdminEvent } from './admin_audit_service.js';
import { getClinic } from './clinic_service.js';
import { demoMode } from './catalog_service.js';
import { clinicDateTime, isFutureBooking, resolveConsultationFee, validDate, validateBookingPatient } from './booking_policy.js';
import nodemailer from 'nodemailer';
import { claimWalkInPatientProfile, linkPatientProfileToAppUser, upsertAppUser } from './account_service.js';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { calculateAppointmentPrice } from './pricing.js';


function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isPatientEmailConflict(error) {
  return String(error?.message || '').includes('patient_profiles_email_lower_unique_idx');
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
  const value = new Date(`${dateValue}T${timeValue}:00+07:00`);
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function appointmentMailHtml({ title, appointment, ticket, input = {}, reminder = false }) {
  const place = appointment.clinic_snapshot?.name || input.facilityName || input.hospitalName || 'Cơ sở y tế';
  const timeText = input.time || appointment.appointment_time_text || '';
  const dateText = input.dateDisplay || toDisplayDate(appointment.appointment_date);
  const patientName = appointment.patient_name || input.patientName || '';
  const code = ticket?.appointment_code || '';
  const lead = reminder
    ? 'Lịch khám của bạn sắp diễn ra. Vui lòng đến sớm khoảng 15 phút để làm thủ tục.'
    : 'MidHealth đã ghi nhận lịch khám của bạn.';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>${escapeHtml(title)}</h2>
      <p>${lead}</p>
      <table style="border-collapse:collapse;width:100%;max-width:620px">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Mã phiếu</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(code)}</strong></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Bệnh nhân</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(patientName)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Nơi khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(place)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Ngày khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(dateText)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Giờ khám</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(timeText)}</strong></td></tr>
      </table>
      ${appointment.delay_minutes > 0 ? `<p><strong>Cập nhật:</strong> Bác sĩ dự kiến trễ khoảng ${escapeHtml(appointment.delay_minutes)} phút. ${escapeHtml(appointment.delay_note || '')}</p>` : ''}
      <p>Vui lòng đến trước giờ hẹn khoảng 15 phút, mang giấy tờ định danh và cung cấp họ tên, ngày sinh để quầy tiếp nhận đối chiếu với hồ sơ. Nếu dự kiến trễ quá 15 phút, hãy liên hệ phòng khám; việc nhận khám phụ thuộc lịch thực tế.</p>
      <p>Bạn có thể mở MidHealth để xem phiếu đặt khám và theo dõi trạng thái lịch hẹn. Kết quả khám chỉ hiển thị sau khi buổi khám hoàn tất.</p>
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

const notificationText = {
  cancelled: ['Lịch khám đã hủy', 'Lịch khám của bạn đã được hủy. Vui lòng mở MidHealth để xem chi tiết và liên hệ phòng khám nếu cần hỗ trợ đổi lịch hoặc hoàn tiền.'],
  no_show: ['Thông báo không đến khám', 'Phòng khám đã ghi nhận bạn không đến lịch khám. Nếu thông tin chưa đúng, vui lòng liên hệ phòng khám để được kiểm tra.'],
  completed: ['Lịch khám đã hoàn tất', 'Buổi khám đã được ghi nhận hoàn tất. Bạn có thể đăng nhập MidHealth để xem kết quả khám khi phòng khám cập nhật.'],
  doctor_delay: ['Bác sĩ có thể đến trễ', 'Giờ khám dự kiến đã thay đổi. Vui lòng mở MidHealth để xem thời gian mới hoặc liên hệ phòng khám.'],
  doctor_absent: ['Bác sĩ vắng mặt', 'Bác sĩ không thể khám theo lịch. Vui lòng liên hệ phòng khám để chọn giờ/bác sĩ khác hoặc xử lý việc hủy lịch, thanh toán.'],
  doctor_available: ['Bác sĩ khám lại theo lịch', 'Phòng khám đã cập nhật bác sĩ có thể khám theo lịch. Vui lòng mở MidHealth để kiểm tra lịch mới nhất hoặc liên hệ phòng khám.'],
  rescheduled: ['Lịch khám đã được chuyển', 'Phòng khám đã chuyển lịch khám sang bác sĩ hoặc giờ khác. Vui lòng mở MidHealth để kiểm tra thông tin mới và liên hệ phòng khám nếu bạn không đồng ý.'],
};

export async function processAppointmentEmailOutbox() {
  if (!hasMailConfig() || !hasSupabaseConfig) return;
  const { data: jobs, error } = await supabase.rpc('claim_appointment_emails', { batch_size: 10 });
  if (error) throw error;
  for (const job of jobs || []) {
    try {
      const { data: appointment, error: appointmentError } = await supabase.from('appointments')
        .select('*, queue_tickets(appointment_code), patient_profiles(email), patient_medical_profiles(email)')
        .eq('id', job.appointment_id).single();
      if (appointmentError) throw appointmentError;
      const stale = (job.kind === 'confirmed' && appointment.status !== 'confirmed')
        || (job.kind === 'reminder' && (appointment.status !== 'confirmed' || appointment.clinician_absent))
        || (['doctor_delay','doctor_absent','doctor_available','rescheduled'].includes(job.kind) && !['pending', 'confirmed'].includes(appointment.status))
        || (job.kind === 'doctor_delay' && (appointment.clinician_absent || !appointment.delay_minutes))
        || (job.kind === 'doctor_absent' && !appointment.clinician_absent)
        || (job.kind === 'doctor_available' && appointment.clinician_absent);
      const isDeliverableEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''))
        && !String(value).toLowerCase().endsWith('.invalid');
      const ownerEmail = appointment.patient_profiles?.email;
      const contactEmail = appointment.patient_medical_profiles?.email;
      const email = isDeliverableEmail(ownerEmail) ? ownerEmail : isDeliverableEmail(contactEmail) ? contactEmail : '';
      const ticket = Array.isArray(appointment.queue_tickets) ? appointment.queue_tickets[0] : appointment.queue_tickets;
      if (!stale && email) {
        if (job.kind === 'confirmed' || job.kind === 'reminder') {
          await sendAppointmentEmail({ owner: { email }, appointment, ticket, reminder: job.kind === 'reminder' });
        } else {
          const [title, standardMessage] = notificationText[job.kind] || notificationText.cancelled;
          const message = job.kind === 'doctor_delay'
            ? `Bác sĩ dự kiến trễ khoảng ${appointment.delay_minutes} phút. ${appointment.delay_note || 'Vui lòng theo dõi cập nhật từ phòng khám.'}`
            : standardMessage;
          await mailTransporter().sendMail({ from: `"MidHealth" <${config.gmailUser}>`, to: email,
            subject: `MidHealth: ${title}`,
            html: `<div style="font-family:Arial,sans-serif"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><p>Mã phiếu: ${escapeHtml(ticket?.appointment_code || '')}</p><p>Ngày khám: ${escapeHtml(toDisplayDate(appointment.appointment_date))} ${escapeHtml(appointment.appointment_time_text || '')}</p></div>` });
        }
      }
      const result = await supabase.from('appointment_email_outbox').update({ sent_at: new Date().toISOString(), claimed_until: null, last_error: null })
        .eq('id', job.id).eq('claimed_until', job.claimed_until);
      if (result.error) throw result.error;
    } catch (sendError) {
      await supabase.from('appointment_email_outbox').update({ claimed_until: null, due_at: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: String(sendError?.message || sendError).slice(0, 300) })
        .eq('id', job.id).eq('claimed_until', job.claimed_until);
    }
  }
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function toDisplayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function todayDateValue() { return clinicDateTime().date; }
function isFutureSlotTime(dateValue, timeValue) { return isFutureBooking(dateValue, String(timeValue).slice(0, 8)); }

function stripAssetPrefix(value = '') {
  return String(value || '').replace(/^\/(?:image_doctor|image_benh_vien|image_phong_kham)\//, '');
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

export async function findOwnerProfile(firebaseUser, client = supabase) {
  const firebaseUid = clean(firebaseUser?.localId || firebaseUser?.uid);
  if (!firebaseUid) return null;
  const { data, error } = await client
    .from('patient_profiles')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findExistingOwnerProfile({ firebaseUid, appUserId }) {
  const lookups = [
    ['firebase_uid', firebaseUid],
    ['app_user_id', appUserId],
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

  const email = normalizeEmail(firebaseUser.email);
  const fullName = clean(profile.fullName || profile.name) || clean(firebaseUser.displayName) || 'MidHealth User';
  const phone = clean(profile.phone) || '0000000000';
  const dateOfBirth = toDate(profile.dateOfBirth || profile.birthDate) || '1900-01-01';
  const accountResult = await upsertAppUser(firebaseUser, {
    fullName,
    email,
    emailVerified: Boolean(firebaseUser.emailVerified || firebaseUser.emailVerifiedByOtp),
    markLogin: true,
  });
  if (!accountResult.ok) throw new Error(accountResult.data?.message || 'Không thể lưu tài khoản.');

  const claimedWalkIn = await claimWalkInPatientProfile(firebaseUser, accountResult.data?.id, {
    ...profile, fullName, phone, dateOfBirth,
    emailVerified: Boolean(firebaseUser.emailVerified || firebaseUser.emailVerifiedByOtp || accountResult.data?.email_verified),
  });
  if (!claimedWalkIn.ok) {
    const error = new Error(claimedWalkIn.data?.message || 'Không thể liên kết hồ sơ người bệnh.');
    error.status = claimedWalkIn.status;
    throw error;
  }
  if (claimedWalkIn.data) return claimedWalkIn.data;

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
    email_verified: Boolean(firebaseUser.emailVerified || firebaseUser.emailVerifiedByOtp || accountResult.data?.email_verified),
    last_login_at: new Date().toISOString(),
  };

  const existingOwner = await findExistingOwnerProfile({
    firebaseUid: firebaseUser.localId,
    appUserId: accountResult.data?.id,
    email,
  });

  if (!existingOwner) {
    const { data: emailOwner, error: emailLookupError } = await supabase
      .from('patient_profiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (emailLookupError) throw emailLookupError;
    if (emailOwner) {
      if (emailOwner.firebase_uid === firebaseUser.localId) return emailOwner;
      const conflict = new Error('Email này đã có hồ sơ bệnh nhân. Vui lòng đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.');
      conflict.status = 409;
      throw conflict;
    }
  }

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

  if (error) {
    if (isPatientEmailConflict(error)) {
      const concurrentOwner = await findOwnerProfile(firebaseUser);
      if (concurrentOwner) return concurrentOwner;
    }
    throw error;
  }
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
    const ownerFields = {
      full_name: owner.full_name,
      phone: owner.phone,
      date_of_birth: owner.date_of_birth,
      gender: owner.gender,
      citizen_id: owner.citizen_id,
      health_insurance_number: owner.health_insurance_number,
      email: owner.email,
      province: owner.province,
      district: owner.district,
      ward: owner.ward,
      address: owner.address,
      ethnicity: owner.ethnicity,
      occupation: owner.occupation,
    };
    const profiles = data || [];
    const primary = profiles.find((item) => item.is_primary);
    if (!primary) {
      return { ok: true, status: 200, data: [{ ...ownerFields, relationship: 'Tôi', is_primary: true }, ...profiles] };
    }
    return { ok: true, status: 200, data: profiles.map((item) => item.is_primary
      ? { ...ownerFields, ...item,
          ...Object.fromEntries(Object.entries(ownerFields).filter(([key]) => !item[key])) }
      : item) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function saveMedicalProfile(firebaseUser, payload = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const profile = payload.profile || payload;
    const validationError = validateBookingPatient(profile);
    if (validationError) return { ok: false, status: 400, data: { message: validationError } };
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
      medical_history: clean(profile.medicalHistory) || null,
      blood_group: clean(profile.bloodGroup) || null,
      allergies: clean(profile.allergies) || null,
      is_primary: Boolean(profile.isPrimary || profile.isMain || profile.relationship === 'Tôi'),
    };

    if ((row.medical_history?.length || 0) > 4000 || (row.allergies?.length || 0) > 2000
      || (row.blood_group && !['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(row.blood_group))) {
      return { ok: false, status: 400, data: { message: 'Tiền sử bệnh, nhóm máu hoặc dị ứng không hợp lệ.' } };
    }

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
    const emailConflict = isPatientEmailConflict(error);
    return {
      ok: false,
      status: emailConflict ? 409 : error.status || 500,
      data: { message: emailConflict
        ? 'Email này đã có hồ sơ bệnh nhân. Vui lòng đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.'
        : error.message },
    };
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

async function lookupDoctor(payload = {}) {
  if (isUuid(payload.doctorId)) {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', payload.doctorId).eq('clinic_owned', true)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  return payload.doctorName ? lookupByName('doctors', 'full_name', payload.doctorName) : null;
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

    if (options.fromDate && !validDate(options.fromDate)) return { ok: false, status: 400, data: { message: 'Ngày bắt đầu không hợp lệ.' } };
    const fromDate = options.fromDate || todayDateValue();
    const days = Math.min(Math.max(Number(options.days) || 7, 1), 14);
    const endDate = (() => {
      const date = new Date(`${fromDate}T00:00:00`);
      date.setDate(date.getDate() + days - 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();

    const { data: activeDoctor, error: doctorError } = await supabase.from('doctors').select('id, unavailable_from, unavailable_to, is_demo').eq('id', doctorId).eq('clinic_owned', true).eq('is_active', true).maybeSingle();
    if (doctorError) throw doctorError;
    if (!activeDoctor || (!demoMode() && activeDoctor.is_demo)) return { ok: false, status: 404, data: { message: 'Bác sĩ hiện không nhận đặt lịch.' } };
    const data = (await fetchDoctorSlotRows(
      doctorId,
      fromDate,
      endDate,
      'id, doctor_id, slot_date, start_time, end_time, capacity, booked_count, is_active',
    )).filter((slot) => slot.is_active && (!activeDoctor.unavailable_from || slot.slot_date < activeDoctor.unavailable_from || slot.slot_date > activeDoctor.unavailable_to));

    const uniqueSlots = new Map();
    (data || [])
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
          status: slot.booked_count >= slot.capacity ? 'full' : 'available',
        })),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
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
      .select('id, status, payment_status, appointment_slot_id, doctor_id, patient_name, patient_phone, appointment_date, appointment_time, appointment_time_text, queue_tickets(appointment_code, queue_number)')
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

    const { data: rows, error } = await supabase.rpc('cancel_clinic_unpaid_appointment', { appointment_id_value: appointmentId, payment_status_value: paymentStatus });
    if (error) throw error;
    const data = Array.isArray(rows) ? rows[0] : rows;
    if (!data) return { ok: false, status: 409, data: { message: 'Lịch đã thanh toán hoặc không thể hủy.' } };

    await logAppointmentNotification({
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
    // A PayPal order can be captured even when our capture request times out.
    // Reconcile those orders with PayPal before releasing their slots.
    const { data: unstarted, error: bookingError } = await supabase.from('appointments')
      .select('id').eq('status', 'pending').eq('payment_status', 'unpaid')
      .lt('created_at', expiredBefore).limit(50);
    if (bookingError) throw bookingError;
    for (const booking of unstarted || []) {
      await cancelAppointmentForFailedPayment(booking.id, 'failed');
    }

    return { ok: true, status: 200, data: { expired: unstarted?.length || 0 } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

async function logAppointmentNotification({ eventType, appointment, ticket = null, firebaseUser = null }) {
  try {
    await logAdminEvent({ actor: firebaseUser, actorRole: 'patient', eventType, entityType: 'appointment', entityId: appointment.id,
      message: eventType === 'appointment_received' ? 'Có lịch khám mới.' : 'Lịch khám đã được hủy.',
      metadata: { appointmentCode: ticket?.appointment_code, appointmentDate: appointment.appointment_date, status: appointment.status } });
  } catch { /* Audit failure must not interrupt a completed booking. */ }
}

const parseSpecialtyResultHistory = (appointment, encounterId) => {
  const marker = `Kết quả khám chuyên khoa [${encounterId}]: `;
  return (appointment.clinical_note_addenda || []).filter(entry => String(entry.content || '').startsWith(marker)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map(entry => {
    try { return { authorName: entry.author_name || 'Bác sĩ', updatedAt: entry.created_at, details: JSON.parse(entry.content.slice(marker.length)) }; } catch { return null; }
  }).filter(Boolean);
};

export function mapAppointmentResponse(appointment, ticket, input = {}) {
  const doctorName = input.doctorName || appointment.doctors?.full_name || 'Đang cập nhật';
  const facilityName = appointment.clinic_snapshot?.name || input.facilityName || appointment.workplace_text || '';
  const specialtyName = input.department || input.specialtyName || appointment.clinic_specialties?.name || '';
  const serviceName = input.serviceName || '';
  const attachments = input.attachments || appointment.appointment_attachments?.map((file) => file.file_name) || [];

  return {
    id: appointment.id,
    type: appointment.appointment_type,
    rawStatus: appointment.status,
    status: appointment.status === 'pending' ? 'Chờ thanh toán cọc'
      : appointment.status === 'no_show' ? 'Không đến khám'
      : appointment.status === 'completed' ? 'Đã khám'
        : appointment.status === 'cancelled' || ticket?.status === 'cancelled' ? 'Đã hủy' : 'Đã đặt lịch',
    ticket: appointment.status === 'pending' ? null : ticket?.ticket_code,
    appointmentCode: appointment.status === 'pending' ? null : ticket?.appointment_code,
    patientCode: appointment.status === 'pending' ? null : ticket?.patient_code,
    number: appointment.status === 'pending' ? null : ticket?.queue_number,
    doctorName,
    doctorShortName: input.doctorShortName || doctorName,
    doctorImage: input.doctorImage || stripAssetPrefix(appointment.doctors?.avatar_url || ''),
    department: specialtyName,
    serviceName,
    hospitalName: facilityName,
    address: appointment.clinic_snapshot?.address || input.address || '',
    clinicPhone: appointment.clinic_snapshot?.phone || input.clinicPhone || '',
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
      medicalHistory: appointment.patient_medical_profiles.medical_history || '',
      bloodGroup: appointment.patient_medical_profiles.blood_group || '',
      allergies: appointment.patient_medical_profiles.allergies || '',
    } : null),
    note: appointment.note || '',
    attachments,
    insuranceUsed: Boolean(appointment.insurance_used ?? input.insuranceUsed),
    insuranceType: appointment.insurance_type || input.insuranceType || '',
    originalAmount: Number(appointment.original_amount ?? input.originalAmount ?? 0),
    insuranceDiscount: Number(appointment.insurance_discount ?? input.insuranceDiscount ?? 0),
    finalAmount: Number(appointment.final_amount ?? input.finalAmount ?? 0),
    depositAmount: Number(appointment.deposit_amount ?? input.depositAmount ?? 0),
    paymentStatus: appointment.payment_status || input.paymentStatus || 'unpaid',
    checkedInAt: appointment.checked_in_at || null,
    delayMinutes: appointment.delay_minutes || 0,
    delayNote: appointment.delay_note || '',
    clinicianAbsent: Boolean(appointment.clinician_absent),
    rescheduledAt: appointment.rescheduled_at || null,
    visitResult: appointment.appointment_clinical_notes ? {
      clinicianName: appointment.appointment_clinical_notes.clinician_name,
      summary: appointment.appointment_clinical_notes.summary,
      diagnosis: appointment.appointment_clinical_notes.diagnosis,
      carePlan: appointment.appointment_clinical_notes.care_plan,
      followUp: appointment.appointment_clinical_notes.follow_up,
      enteredAt: appointment.appointment_clinical_notes.entered_at,
    } : null,
    specialtyResults: (appointment.clinical_encounters || [])
      .filter(encounter => encounter.status === 'completed')
      .map(encounter => {
        const doctor = Array.isArray(encounter.doctors) ? encounter.doctors[0] : encounter.doctors;
        const specialty = Array.isArray(encounter.clinic_specialties) ? encounter.clinic_specialties[0] : encounter.clinic_specialties;
        const resultHistory = parseSpecialtyResultHistory(appointment, encounter.id);
        const latestResult = resultHistory.at(-1);
        return {
          stage: encounter.stage,
          specialtyName: specialty?.name || '',
          doctorName: doctor?.full_name || '',
          symptoms: encounter.symptoms || '',
          diagnosis: encounter.provisional_diagnosis || '',
          completedAt: encounter.completed_at || null,
          resultHistory,
          result: latestResult?.details || null,
          resultAuthor: latestResult?.authorName || doctor?.full_name || '',
          resultUpdatedAt: latestResult?.updatedAt || encounter.completed_at || null,
        };
      }),
    healthProfileUpdates: (appointment.clinical_note_addenda || [])
      .filter(entry => String(entry.content || '').startsWith('Hồ sơ sức khỏe được cập nhật sau lượt khám chuyên khoa:'))
      .map(entry => ({ authorName: entry.author_name || 'Bác sĩ', content: entry.content, createdAt: entry.created_at })),
    prescription: (appointment.prescription_items || []).map(item => ({
      medicineName: item.medicine_name, dosage: item.dosage, frequency: item.frequency,
      duration: item.duration, quantity: item.quantity,
    })),
  };
}

export async function createAppointment(firebaseUser, payload = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const patient = payload.patientProfile || payload.patient || {};
    if (!isUuid(patient.id)) return { ok: false, status: 400, data: { message: 'Vui lòng lưu và chọn hồ sơ bệnh nhân trước khi đặt lịch.' } };
    if (payload.reason != null && (typeof payload.reason !== 'string' || payload.reason.length > 2000)) return { ok: false, status: 400, data: { message: 'Lý do khám phải là văn bản tối đa 2.000 ký tự.' } };
    const doctor = await lookupDoctor(payload);
    if ((payload.type && payload.type !== 'doctor') || payload.facilityId || payload.hospitalId || payload.clinicId) {
      return { ok: false, status: 400, data: { message: 'Vui lòng chọn bác sĩ của phòng khám.' } };
    }
    if (!doctor?.id || !doctor.is_active || !doctor.clinic_owned || (!demoMode() && doctor.is_demo) || !isUuid(payload.appointmentSlotId)) {
      return { ok: false, status: 400, data: { message: 'Bác sĩ hoặc khung giờ khám không hợp lệ.' } };
    }
    const clinic = await getClinic();
    payload = { ...payload, doctorName: doctor.full_name, facilityName: clinic.name, hospitalName: clinic.name, address: clinic.address, clinicPhone: clinic.phone };
    const patientError = validateBookingPatient(patient);
    if (patientError) return { ok: false, status: 400, data: { message: patientError } };
    const { data: specialty, error: specialtyError } = await supabase.from('clinic_specialties').select('id, name, consultation_fee').eq('id', doctor.specialty_id).eq('clinic_owned', true).eq('is_active', true).maybeSingle();
    if (specialtyError) throw specialtyError;
    if (!specialty) return { ok: false, status: 400, data: { message: 'Chuyên khoa của bác sĩ chưa mở đặt lịch.' } };
    payload = { ...payload, department: specialty.name, specialtyName: specialty.name, patientName: patient.fullName || patient.name, phone: patient.phone };
    const appointmentDate = payload.dateValue || payload.appointmentDate || payload.date;
    const appointmentTime = clean(payload.time || payload.appointmentTime);
    const parsedAppointmentTime = toTime(appointmentTime);
    const patientName = clean(payload.patientName || patient.fullName || patient.name || payload.patient);
    // A card number in the profile is only a reference for reception. This app
    // has no BHXH eligibility/benefit verification or claims connection, so a
    // client flag must never label the appointment as insurance-covered.
    const consultationFee = resolveConsultationFee(doctor.consultation_fee, specialty.consultation_fee);
    if (consultationFee == null) return { ok: false, status: 503, data: { message: 'Phí khám của bác sĩ hoặc chuyên khoa chưa được cấu hình hợp lệ.' } };
    const price = calculateAppointmentPrice({ consultationFee });
    if (price.finalAmount > 0 && (!config.paypalClientId || !config.paypalClientSecret
      || config.paypalCurrency !== 'USD' || !Number.isFinite(config.paypalVndToUsdRate)
      || config.paypalVndToUsdRate <= 0)) {
      return { ok: false, status: 503, data: { message: 'Thanh toán cọc trực tuyến chưa sẵn sàng. Vui lòng liên hệ phòng khám hoặc đăng ký tại quầy.' } };
    }
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

    if (isUuid(patient.id)) {
      const { data: owned, error } = await supabase.from('patient_medical_profiles').select('id').eq('id', patient.id).eq('owner_profile_id', owner.id).maybeSingle();
      if (error) throw error;
      if (!owned) return { ok: false, status: 403, data: { message: 'Bạn không có quyền sử dụng hồ sơ bệnh nhân này.' } };
    }
    let appointmentSlot = null;
    if (doctor?.id) {
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

        slotQuery = slotQuery.eq('doctor_id', doctor.id);

        const result = await slotQuery;
        slots = result.data || [];
        slotError = result.error;
      }

      if (slotError) throw slotError;
      appointmentSlot = (slots || [])
        .filter((slot) => !doctor?.id || slot.doctor_id === doctor.id)

        .filter((slot) => !specialty?.id || !slot.specialty_id || slot.specialty_id === specialty.id)[0] || null;


      if (appointmentSlot && (appointmentSlot.booked_count || 0) >= (appointmentSlot.capacity || 1)) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay da het cho. Vui long chon khung gio khac.' } };
      }
      if (!appointmentSlot) {
        return { ok: false, status: 409, data: { message: 'Khung gio nay khong con kha dung. Vui long chon khung gio khac.' } };
      }
    }

    const appointmentRow = {
      owner_profile_id: owner?.id || null,
      patient_medical_profile_id: isUuid(patient.id) ? patient.id : null,
      appointment_slot_id: appointmentSlot?.id || null,
      appointment_type: 'doctor',
      workplace_text: clinic.name,
      clinic_snapshot: clinic,
      doctor_id: doctor?.id || null,
      specialty_id: specialty?.id || doctor?.specialty_id || null,
      appointment_date: appointmentDate,
      appointment_time: parsedAppointmentTime,
      appointment_start_time: parsedAppointmentTime,
      appointment_end_time: appointmentSlot?.end_time || null,
      appointment_time_text: `${formatTime(appointmentSlot.start_time)}-${formatTime(appointmentSlot.end_time)}`,
      patient_name: patientName,
      patient_phone: clean(payload.phone || patient.phone) || null,
      reason: clean(payload.reason) || null,
      note: clean(payload.note) || null,
      status: price.finalAmount > 0 ? 'pending' : 'confirmed',
      insurance_used: false,
      insurance_type: null,
      insurance_rate: price.insuranceRate,
      original_amount: price.originalAmount,
      insurance_discount: price.insuranceDiscount,
      final_amount: price.finalAmount,
      payment_status: price.finalAmount > 0 ? 'unpaid' : 'paid',
    };

    const { data: booking, error: bookingError } = await supabase.rpc('create_clinic_booking', { booking: appointmentRow });
    if (bookingError) {
      const duplicatePatient = bookingError.message === 'Patient already booked this slot';
      const slotConflict = bookingError.message === 'Slot is unavailable';
      const bookingConflict = bookingError.code === 'P0001' || duplicatePatient;
      return { ok: false, status: bookingConflict ? 409 : 503,
        data: { message: duplicatePatient
          ? 'Hồ sơ bệnh nhân này đã có lịch ở khung giờ đã chọn.'
          : slotConflict
            ? 'Khung giờ vừa hết chỗ. Vui lòng chọn khung giờ khác.'
            : bookingConflict
              ? 'Khung giờ hoặc phí khám đã thay đổi. Vui lòng chọn lại lịch.'
              : 'Không thể lưu lịch khám. Vui lòng thử lại sau.' } };
    }
    const { appointment, ticket } = booking || {};
    if (!appointment?.id || !ticket?.id) throw new Error('Không nhận được phiếu khám từ cơ sở dữ liệu.');

    await logAppointmentNotification({
      eventType: 'appointment_received',
      appointment,
      ticket,
      owner,
      firebaseUser,
    });

    return {
      ok: true,
      status: 201,
      data: mapAppointmentResponse(appointment, ticket, {
        ...payload,
        insuranceUsed: false,
        insuranceType: '',
        originalAmount: price.originalAmount,
        insuranceDiscount: price.insuranceDiscount,
        finalAmount: price.finalAmount,
        paymentStatus: price.finalAmount > 0 ? 'unpaid' : 'paid',
      }),
    };
  } catch (error) {
    return { ok: false, status: error.status || 500, data: { message: error.message } };
  }
}

export async function listAppointments(firebaseUser) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: true, status: 200, data: [] };

    const appointments = [];
    let lastId = null;
    for (;;) {
      let query = supabase.from('appointments')
        .select('*, queue_tickets(*), appointment_attachments(file_name), appointment_clinical_notes(*), clinical_note_addenda(id,author_name,content,created_at), clinical_encounters(id,stage,status,symptoms,provisional_diagnosis,completed_at,doctors(full_name),clinic_specialties(name)), doctors(full_name, avatar_url), clinic_specialties(name), patient_medical_profiles(*)')
        .eq('owner_profile_id', owner.id)
        .order('id', { ascending: true }).limit(200);
      if (lastId) query = query.gt('id', lastId);
      const { data: page, error } = await query;
      if (error) throw error;
      appointments.push(...(page || []));
      if (!page || page.length < 200) break;
      lastId = page[page.length - 1].id;
    }
    appointments.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (appointments.length) {
      const byAppointment = new Map();
      for (let offset = 0; offset < appointments.length; offset += 100) {
        let lastPrescriptionId = null;
        for (;;) {
          let query = supabase.from('prescription_items')
            .select('id,appointment_id,medicine_name,dosage,frequency,duration,quantity')
            .in('appointment_id', appointments.slice(offset, offset + 100).map(appointment => appointment.id))
            .order('id', { ascending: true }).limit(500);
          if (lastPrescriptionId) query = query.gt('id', lastPrescriptionId);
          const { data: items, error: prescriptionError } = await query;
          // Older installations may not have applied the Word workflow migration yet.
          if (prescriptionError && !['PGRST205', '42P01'].includes(prescriptionError.code)) throw prescriptionError;
          if (prescriptionError) break;
          for (const item of items || []) {
            const existing = byAppointment.get(item.appointment_id) || [];
            existing.push(item);
            byAppointment.set(item.appointment_id, existing);
          }
          if (!items || items.length < 500) break;
          lastPrescriptionId = items[items.length - 1].id;
        }
      }
      for (const appointment of appointments) appointment.prescription_items = byAppointment.get(appointment.id) || [];
    }

    return {
      ok: true,
      status: 200,
      data: appointments.map((appointment) => mapAppointmentResponse(
        appointment,
        Array.isArray(appointment.queue_tickets) ? appointment.queue_tickets[0] : appointment.queue_tickets,
      )),
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function cancelAppointment(firebaseUser, appointmentId) {
  const ready = await requireSupabase(); if (!ready.ok) return ready;
  if (!isUuid(appointmentId)) return { ok: false, status: 400, data: { message: 'Mã lịch khám không hợp lệ.' } };
  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 403, data: { message: 'Không có quyền hủy lịch này.' } };
    const { data, error } = await supabase.rpc('cancel_clinic_patient_appointment', { appointment_id_value: appointmentId, owner_id_value: owner.id });
    if (error) {
      const messages = {
        'Paid appointment requires clinic cancellation': 'Lịch đã thanh toán. Vui lòng liên hệ phòng khám để được hỗ trợ hủy và xử lý khoản đã thanh toán.',
        'Payment is being processed': 'Thanh toán đang được đối soát. Vui lòng chờ kết quả hoặc liên hệ phòng khám trước khi hủy.',
        'Appointment has started': 'Lịch đã đến giờ khám hoặc đã bắt đầu. Vui lòng liên hệ phòng khám để được hỗ trợ.',
        'Checked-in appointment cannot be cancelled': 'Lịch đã check-in và không thể tự hủy. Vui lòng trao đổi với nhân viên phòng khám.',
        'Appointment is already closed': 'Lịch này đã kết thúc hoặc đã được xử lý.',
      };
      return { ok: false, status: 409, data: { message: messages[error.message] || 'Không thể tự hủy lịch này. Vui lòng tải lại hoặc liên hệ phòng khám.' } };
    }
    if (!data?.length) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
    await logAppointmentNotification({ eventType: 'appointment_cancelled_by_patient', appointment: data[0], owner, firebaseUser });
    return { ok: true, status: 200, data: data[0] };
  } catch (error) { return { ok: false, status: 500, data: { message: error.message } }; }
}

export async function reschedulePatientAppointment(firebaseUser, appointmentId, slotId) {
  const ready = await requireSupabase(); if (!ready.ok) return ready;
  if (!isUuid(appointmentId) || !isUuid(slotId)) return { ok: false, status: 400, data: { message: 'Mã lịch hoặc khung giờ mới không hợp lệ.' } };
  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 403, data: { message: 'Không tìm thấy tài khoản bệnh nhân.' } };
    const { data: appointment, error: lookupError } = await supabase.from('appointments')
      .select('id,owner_profile_id,status,payment_status,checked_in_at')
      .eq('id', appointmentId).eq('owner_profile_id', owner.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!appointment) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám trong tài khoản của bạn.' } };
    if (!['pending', 'confirmed'].includes(appointment.status) || appointment.checked_in_at) return { ok: false, status: 409, data: { message: 'Lịch này không còn được phép đổi giờ. Vui lòng liên hệ phòng khám.' } };
    if (appointment.payment_status === 'pending') return { ok: false, status: 409, data: { message: 'Thanh toán đang được đối soát; vui lòng chờ kết quả hoặc liên hệ phòng khám trước khi đổi lịch.' } };
    const { data, error } = await supabase.rpc('reschedule_clinic_appointment', {
      appointment_id_value: appointmentId, new_slot_id_value: slotId,
    });
    if (error) return { ok: false, status: 409, data: { message: error.message === 'New slot is unavailable'
      ? 'Khung giờ vừa hết chỗ hoặc bác sĩ không nhận khám. Vui lòng tải lại lịch và chọn khung giờ khác.'
      : 'Không thể đổi lịch này. Vui lòng tải lại hoặc liên hệ phòng khám.' } };
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) return { ok: false, status: 409, data: { message: 'Lịch không còn khả dụng để đổi.' } };
    try { await logAdminEvent({ actor: firebaseUser, actorRole: 'patient', eventType: 'appointment_rescheduled_by_patient', entityType: 'appointment', entityId: appointmentId,
      message: 'Bệnh nhân tự đổi khung giờ khám.', metadata: { appointmentDate: updated.appointment_date } }); } catch { /* Audit must not undo a completed reschedule. */ }
    return { ok: true, status: 200, data: updated };
  } catch (error) { return { ok: false, status: 500, data: { message: error.message || 'Không thể đổi lịch khám.' } }; }
}
