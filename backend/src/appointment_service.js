import { hasSupabaseConfig, supabase } from './supabase.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
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
  if (!firebaseUser?.localId) return null;

  const { data, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('firebase_uid', firebaseUser.localId)
    .maybeSingle();

  if (error) throw error;
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
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) {
      return { ok: false, status: 401, data: { message: 'Chưa có hồ sơ tài khoản để lưu hồ sơ bệnh nhân.' } };
    }

    const profile = payload.profile || payload;
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

    const query = supabase.from('patient_medical_profiles');
    const { data, error } = profile.id
      ? await query.update(row).eq('id', profile.id).eq('owner_profile_id', owner.id).select().single()
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

    return { ok: true, status: profile.id ? 200 : 201, data };
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

async function nextQueueNumber() {
  const { data, error } = await supabase
    .from('queue_tickets')
    .select('queue_number')
    .order('queue_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.queue_number || 0) + 1;
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
  };
}

export async function createAppointment(firebaseUser, payload = {}) {
  const ready = await requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = await findOwnerProfile(firebaseUser);
    const patient = payload.patientProfile || payload.patient || {};
    const doctor = payload.doctorName ? await lookupByName('doctors', 'full_name', payload.doctorName) : null;
    const facilityName = payload.facilityName || payload.hospitalName || payload.clinicName;
    const facility = facilityName ? await lookupByName('medical_facilities', 'name', facilityName) : null;
    const specialty = payload.department || payload.specialtyName
      ? await lookupByName('clinic_specialties', 'name', payload.department || payload.specialtyName)
      : null;

    const appointmentDate = payload.dateValue || payload.appointmentDate || payload.date;
    const appointmentTime = clean(payload.time || payload.appointmentTime);
    const parsedAppointmentTime = toTime(appointmentTime);
    const patientName = clean(payload.patientName || patient.fullName || patient.name || payload.patient);
    if (!appointmentDate || !appointmentTime || !parsedAppointmentTime || !patientName) {
      return { ok: false, status: 400, data: { message: 'Thiếu ngày khám, giờ khám hoặc tên bệnh nhân.' } };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate)) || String(appointmentDate) < todayDateValue()) {
      return { ok: false, status: 400, data: { message: 'Ngày khám không hợp lệ hoặc đã qua.' } };
    }

    const appointmentRow = {
      owner_profile_id: owner?.id || null,
      patient_medical_profile_id: isUuid(patient.id) ? patient.id : null,
      appointment_type: payload.type || (doctor ? 'doctor' : facility?.type === 'clinic' ? 'clinic' : 'hospital'),
      facility_id: facility?.id || doctor?.facility_id || null,
      doctor_id: doctor?.id || null,
      specialty_id: specialty?.id || doctor?.specialty_id || null,
      appointment_date: appointmentDate,
      appointment_time: parsedAppointmentTime,
      appointment_time_text: appointmentTime,
      patient_name: patientName,
      patient_phone: clean(payload.phone || patient.phone) || null,
      reason: clean(payload.reason) || null,
      note: clean(payload.note) || null,
      status: 'confirmed',
    };

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentRow)
      .select()
      .single();
    if (appointmentError) throw appointmentError;

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
      data: mapAppointmentResponse(appointment, ticket, payload),
    };
  } catch (error) {
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

  try {
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 401, data: { message: 'Bạn cần đăng nhập để hủy lịch.' } };

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('owner_profile_id', owner.id)
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from('queue_tickets')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId);

    return { ok: true, status: 200, data };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
