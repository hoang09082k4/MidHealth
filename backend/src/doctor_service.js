import { requireRoles, APP_ROLES } from './authorization_service.js';
import { supabase } from './supabase.js';
import { getAdminSchedule, saveAdminSlot, updateAdminSlot, getDepartmentDoctors } from './admin_schedule_service.js';
import { clinicDateTime, validDate } from './booking_policy.js';
import { logAdminEvent } from './admin_audit_service.js';
import { mutateClinicProfile } from './clinic_profile_store.js';

const fail = (message, status = 400) => ({ ok: false, status, data: { message } });
const ok = data => ({ ok: true, status: 200, data });

async function ownDoctor(user) {
  const access = await requireRoles(user, [APP_ROLES.DOCTOR, APP_ROLES.HEAD]);
  if (!access.ok) return access;
  if (!access.data.doctor_id) return fail('Tài khoản bác sĩ chưa được liên kết hồ sơ.', 403);
  const { data, error } = await supabase.from('doctors').select('id,full_name,specialty_id,is_active,is_demo,avatar_url,intro,title,workplace_text,years_experience,consultation_fee,clinic_specialties(name,consultation_fee)').eq('id', access.data.doctor_id).eq('clinic_owned', true).maybeSingle();
  if (error) return fail('Không thể tải hồ sơ bác sĩ.', 503);
  if (!data?.is_active) return fail('Hồ sơ bác sĩ không còn hoạt động.', 403);
  const { data: clinicProfile, error: profileError } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (profileError) return fail('Không thể tải thông tin liên hệ bác sĩ.', 503);
  const contact = clinicProfile?.profile?.doctorContacts?.[data.id] || {};
  const { clinic_specialties: specialty, ...doctor } = data;
  return ok({ account: access.data, doctor: { ...doctor,
    specialty_name: specialty?.name || '', booking_fee: specialty?.consultation_fee == null ? null : Number(specialty.consultation_fee),
    birth_date: contact.birthDate || '', contact_email: contact.email || '', contact_phone: contact.phone || '',
    education: contact.education || '', expertise: contact.expertise || '', license_number: contact.licenseNumber || '',
    short_description: contact.shortDescription || '',
  } });
}

export async function updateDoctorProfile(user, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Thông tin hồ sơ bác sĩ không hợp lệ.');
  const has = key => Object.prototype.hasOwnProperty.call(payload, key);
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const textFields = ['title', 'intro', 'workplace', 'contactPhone', 'contactEmail', 'image', 'education', 'expertise', 'shortDescription'];
  if (textFields.some(key => has(key) && typeof payload[key] !== 'string')) return fail('Thông tin hồ sơ bác sĩ không hợp lệ.');
  const title = clean(payload.title), intro = clean(payload.intro), workplace = clean(payload.workplace);
  const phone = clean(payload.contactPhone), email = clean(payload.contactEmail).toLowerCase();
  const image = clean(payload.image), education = clean(payload.education), expertise = clean(payload.expertise);
  const shortDescription = clean(payload.shortDescription);
  const years = !has('yearsExperience') || payload.yearsExperience === '' || payload.yearsExperience === null ? null : Number(payload.yearsExperience);
  if ((has('title') && title.length > 100) || (has('intro') && intro.length > 5000) ||
      (has('workplace') && workplace.length > 160) ||
      (has('contactPhone') && phone && (!/^\+?[\d\s().-]{9,20}$/.test(phone) || !/^\d{9,15}$/.test(phone.replace(/\D/g, '')))) ||
      (has('contactEmail') && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (has('image') && image && !/^(\/[^/\\]|https:\/\/)/.test(image)) ||
      (has('education') && education.length > 500) || (has('expertise') && expertise.length > 500) ||
      (has('shortDescription') && shortDescription.length > 240) ||
      (has('yearsExperience') && years !== null && (!Number.isInteger(years) || years < 0 || years > 80))) return fail('Thông tin hồ sơ bác sĩ không hợp lệ.');
  const doctorId = access.data.doctor.id;
  const doctorPatch = {};
  if (has('title')) doctorPatch.title = title;
  if (has('intro')) doctorPatch.intro = intro;
  if (has('workplace')) doctorPatch.workplace_text = workplace;
  if (has('image')) doctorPatch.avatar_url = image || null;
  if (has('yearsExperience')) doctorPatch.years_experience = years;
  if (Object.keys(doctorPatch).length) {
    const { error } = await supabase.from('doctors').update(doctorPatch).eq('id', doctorId);
    if (error) return fail('Không thể lưu hồ sơ bác sĩ.', 503);
  }
  const contactPatch = {};
  if (has('contactEmail')) contactPatch.email = email;
  if (has('contactPhone')) contactPatch.phone = phone;
  if (has('education')) contactPatch.education = education;
  if (has('expertise')) contactPatch.expertise = expertise;
  if (has('shortDescription')) contactPatch.shortDescription = shortDescription;
  if (Object.keys(contactPatch).length) {
    const saved = await mutateClinicProfile(profile => {
      const doctorContacts = { ...(profile.doctorContacts || {}) };
      doctorContacts[doctorId] = { ...doctorContacts[doctorId], ...contactPatch };
      return { ...profile, doctorContacts };
    });
    if (saved.error) return fail('Không thể lưu thông tin liên hệ.', saved.error.code === 'PROFILE_CONFLICT' ? 409 : 503);
  }
  return getDoctorWorkspace(user);
}

export async function getDoctorWorkspace(user, date, pageValue = 1, statusValue = '', searchValue = '') {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (date && !validDate(date)) return fail('Ngày khám không hợp lệ.');
  const page = Number(pageValue);
  const pageSize = 50;
  const validStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
  const status = String(statusValue || '');
  const search = String(searchValue || '').trim().slice(0, 80).replace(/[^\p{L}\p{N}\s+-]/gu, '');
  if (!Number.isInteger(page) || page < 1 || page > 10000 || (status && !validStatuses.has(status))) return fail('Bộ lọc lịch khám không hợp lệ.');
  const select = 'id,doctor_id,specialty_id,appointment_date,appointment_time_text,patient_name,patient_phone,status,checked_in_at,clinician_absent,delay_minutes,queue_tickets(appointment_code),appointment_clinical_notes(clinician_name,summary,diagnosis,care_plan,follow_up,entered_at,entered_by,allergies_reviewed),clinical_note_addenda(id,author_name,content,created_at),clinical_encounters(id,stage,doctor_id,specialty_id,status,symptoms,provisional_diagnosis,referred_slot_id,completed_at,doctors(full_name),appointment_slots(slot_date,start_time,end_time)),prescription_items(medicine_name,dosage,frequency,duration,quantity),clinical_material_usage(material_name,quantity,entered_by)';
  let appointments = supabase.from('appointments').select(select, { count: 'exact' })
    .order('appointment_date', { ascending: false }).order('appointment_time_text', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  appointments = access.data.account.role === APP_ROLES.HEAD
    ? appointments.eq('specialty_id', access.data.doctor.specialty_id)
    : appointments.eq('doctor_id', access.data.doctor.id);
  if (date) appointments = appointments.eq('appointment_date', date);
  if (status) appointments = appointments.eq('status', status);
  if (search) appointments = appointments.or(`patient_name.ilike.%${search}%,patient_phone.ilike.%${search}%`);
  const { data, error, count } = await appointments;
  if (error) return fail('Không thể tải lịch khám của bác sĩ.', 503);
  const referrals = page === 1
    ? await supabase.from('clinical_encounters').select('appointment_id').eq('doctor_id', access.data.doctor.id).eq('status', 'waiting').limit(500)
    : { data: [], error: null };
  if (referrals.error) return fail('Không thể tải danh sách chuyển khoa.', 503);
  const extraIds = [...new Set((referrals.data || []).map(row => row.appointment_id))]
    .filter(id => !(data || []).some(row => row.id === id));
  let extra = [];
  if (extraIds.length) {
    let query = supabase.from('appointments').select(select).in('id', extraIds);
    if (date) query = query.eq('appointment_date', date);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`patient_name.ilike.%${search}%,patient_phone.ilike.%${search}%`);
    const result = await query;
    if (result.error) return fail('Không thể tải danh sách chuyển khoa.', 503);
    extra = result.data || [];
  }
  const specialties = await supabase.from('clinic_specialties').select('id,name')
    .eq('clinic_owned', true).eq('is_active', true).order('name');
  if (specialties.error) return fail('Không thể tải danh sách chuyên khoa.', 503);
  const visible = [...(data || []), ...extra].map(appointment => ({
    ...appointment,
    clinical_encounters: access.data.account.role === APP_ROLES.HEAD
      ? appointment.clinical_encounters
      : (appointment.clinical_encounters || []).filter(encounter => encounter.doctor_id === access.data.doctor.id),
  }));
  for (const appointment of visible) {
    appointment.clinical_encounters = (appointment.clinical_encounters || []).map(encounter => {
      const marker = specialtyResultMarker(encounter.id);
      const revisions = (appointment.clinical_note_addenda || []).filter(row => String(row.content || '').startsWith(marker)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map(row => {
        try { return { authorName: row.author_name || 'Bác sĩ', createdAt: row.created_at, details: JSON.parse(row.content.slice(marker.length)) }; } catch { return null; }
      }).filter(Boolean);
      return { ...encounter, specialtyResult: revisions.at(-1) || null, specialtyResultHistory: revisions };
    });
  }
  const eligibleMedicalRecordIds = visible
    .filter(appointment => appointment.checked_in_at && ['confirmed', 'completed'].includes(appointment.status))
    .map(appointment => appointment.id);
  let medicalRecordsByAppointment = new Map();
  if (eligibleMedicalRecordIds.length) {
    const medicalRecords = await supabase.from('appointments')
      .select('id,patient_medical_profiles(medical_history,blood_group,allergies)')
      .in('id', eligibleMedicalRecordIds)
      .not('checked_in_at', 'is', null)
      .in('status', ['confirmed', 'completed']);
    if (medicalRecords.error) return fail('KhÃ´ng thá»ƒ táº£i há»“ sÆ¡ sá»©c khá»e sau khi tiáº¿p nháº­n.', 503);
    medicalRecordsByAppointment = new Map((medicalRecords.data || []).map(appointment => [
      appointment.id,
      Array.isArray(appointment.patient_medical_profiles)
        ? appointment.patient_medical_profiles[0] || null
        : appointment.patient_medical_profiles || null,
    ]));
  }
  for (const appointment of visible) {
    appointment.patient_medical_profiles = medicalRecordsByAppointment.get(appointment.id) || null;
  }
  const extraCount = extra.length;
  return ok({ doctor: access.data.doctor, role: access.data.account.role, specialties: specialties.data || [], appointments: visible,
    pagination: { page, pageSize, total: count || 0, extraCount, hasMore: page * pageSize < (count || 0) },
  });
}

export async function getDoctorReport(user, fromDate, toDate) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  const range = doctorReportRange(fromDate, toDate);
  if (!range) return fail('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
  const { from, to } = range;
  const statuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
  const count = (status, checkedIn = false) => {
    let query = supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('doctor_id', access.data.doctor.id).gte('appointment_date', from).lte('appointment_date', to);
    if (status) query = query.eq('status', status);
    if (checkedIn) query = query.not('checked_in_at', 'is', null);
    return query;
  };
  const results = await Promise.all([count(), ...statuses.map(status => count(status)), count(null, true)]);
  if (results.some(result => result.error)) return fail('Không thể tải báo cáo bác sĩ.', 503);
  return ok({ doctorId: access.data.doctor.id, from, to, total: results[0].count || 0,
    byStatus: Object.fromEntries(statuses.map((status, index) => [status, results[index + 1].count || 0])),
    checkedIn: results.at(-1).count || 0 });
}

export function doctorReportRange(fromDate, toDate, today = clinicDateTime().date) {
  const to = toDate || today;
  if (!validDate(to)) return null;
  const from = fromDate || new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  if (!validDate(from) || from > to ||
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 365) return null;
  return { from, to };
}

export async function completeDoctorVisit(user, appointmentId, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (access.data.account.role !== APP_ROLES.HEAD) return fail('Chỉ trưởng khoa được kết luận cuối cùng.', 403);
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return fail('Mã lịch khám không hợp lệ.');
  const fields = ['summary', 'diagnosis', 'carePlan'];
  if (fields.some(key => typeof payload[key] !== 'string' || !payload[key].trim() || payload[key].length > 4000)
    || String(payload.followUp || '').length > 2000) return fail('Cần nhập tóm tắt, kết luận và hướng dẫn chăm sóc.');
  const { data: appointment, error: lookupError } = await supabase.from('appointments').select('id').eq('id', appointmentId).eq('specialty_id', access.data.doctor.specialty_id).maybeSingle();
  if (lookupError) return fail('Không thể kiểm tra lịch khám.', 503);
  if (!appointment) return fail('Không tìm thấy lịch khám thuộc bác sĩ này.', 404);
  const medicines = Array.isArray(payload.medicines) ? payload.medicines : [];
  if (medicines.length > 30 || medicines.some(item => !item || !['name','dosage','frequency','duration'].every(key => typeof item[key] === 'string' && item[key].trim().length >= 2) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 1000)) return fail('Đơn thuốc không hợp lệ.');
  if (medicines.length && payload.allergiesReviewed !== true) return fail('Xác nhận đã rà soát dị ứng và tiền sử thuốc trước khi lưu đơn.');
  const materials = Array.isArray(payload.materials) ? payload.materials : [];
  if (materials.length > 30 || materials.some(item => !item || typeof item.name !== 'string' || item.name.trim().length < 2 || item.name.length > 200 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10000)) return fail('Vật tư sử dụng không hợp lệ.');
  const { data, error } = await supabase.rpc('finalize_clinic_visit', {
    appointment_id_value: appointmentId,
    actor_id_value: access.data.account.id,
    summary_value: payload.summary.trim(), diagnosis_value: payload.diagnosis.trim(),
    care_plan_value: payload.carePlan.trim(), follow_up_value: String(payload.followUp || '').trim(),
    allergies_reviewed_value: payload.allergiesReviewed === true,
    medicines_value: medicines,
    materials_value: materials,
  });
  if (error) return fail(error.message, 409);
  await logAdminEvent({ actor: user, actorRole: access.data.account.role, eventType: 'clinical.visit_finalized', entityType: 'appointment', entityId: appointmentId, message: 'Hoàn tất hồ sơ lượt khám.', metadata: { specialtyId: access.data.doctor.specialty_id, medicineLines: medicines.length, materialLines: materials.length } });
  return data?.length ? ok(data[0]) : fail('Không tìm thấy lịch khám.', 404);
}

export async function appendClinicalNoteAddendum(user, appointmentId, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (access.data.account.role !== APP_ROLES.HEAD) return fail('Chỉ trưởng khoa được bổ sung kết quả cuối.', 403);
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return fail('Mã lịch khám không hợp lệ.');
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (content.length < 10 || content.length > 4000) return fail('Nội dung bổ sung cần từ 10 đến 4000 ký tự.');
  const { data, error } = await supabase.rpc('append_clinical_note_addendum', {
    appointment_id_value: appointmentId,
    actor_id_value: access.data.account.id,
    content_value: content,
  });
  if (error) return fail(error.message, 409);
  await logAdminEvent({ actor: user, actorRole: access.data.account.role, eventType: 'clinical.note_addendum_added', entityType: 'appointment', entityId: appointmentId, message: 'Bổ sung ghi chú hồ sơ khám.', metadata: { contentLength: content.length } });
  return data?.length ? ok(data[0]) : fail('Không tìm thấy hồ sơ khám đã hoàn tất.', 404);
}

export async function recordSpecialtyExam(user, encounterId, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(encounterId)) return fail('Mã lượt khám không hợp lệ.');
  const symptoms = String(payload.symptoms || '').trim();
  const diagnosis = String(payload.diagnosis || '').trim();
  const nextSpecialtyId = payload.nextSpecialtyId || null;
  const nextSlotId = payload.nextSlotId || null;
  const materials = Array.isArray(payload.materials) ? payload.materials : [];
  if (symptoms.length < 5 || symptoms.length > 4000 || diagnosis.length < 2 || diagnosis.length > 2000
    || (nextSpecialtyId && !/^[0-9a-f-]{36}$/i.test(nextSpecialtyId))
    || (nextSlotId && !/^[0-9a-f-]{36}$/i.test(nextSlotId))
    || Boolean(nextSpecialtyId) !== Boolean(nextSlotId)
    || materials.length > 30 || materials.some(item => !item || typeof item.name !== 'string' || item.name.trim().length < 2 || item.name.length > 200 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10000)) return fail('Kiểm tra kết quả, vật tư và khung giờ tiếp nhận trước khi lưu.');
  const { data, error } = await supabase.rpc('record_specialty_exam', {
    encounter_id_value: encounterId, actor_id_value: access.data.account.id,
    symptoms_value: symptoms, diagnosis_value: diagnosis, next_specialty_id_value: nextSpecialtyId,
    next_slot_id_value: nextSlotId, materials_value: materials,
  });
  if (error) return fail(error.message, 409);
  const encounter = data?.[0];
  await logAdminEvent({ actor: user, actorRole: access.data.account.role, eventType: 'clinical.specialty_exam_recorded', entityType: 'clinical_encounter', entityId: encounter?.id || encounterId, message: 'Ghi kết quả lượt khám chuyên khoa.', metadata: { specialtyId: encounter?.specialty_id || access.data.doctor.specialty_id, materialLines: materials.length, referred: Boolean(nextSlotId) } });
  return data?.length ? ok(data[0]) : fail('Không tìm thấy lượt khám.', 404);
}

const specialtyResultMarker = encounterId => `Kết quả khám chuyên khoa [${encounterId}]: `;
const normalizeSpecialtyResult = payload => ({
  chiefComplaint: String(payload.chiefComplaint || '').trim(),
  symptoms: String(payload.symptoms || '').trim(),
  history: String(payload.history || '').trim(),
  bloodPressure: String(payload.bloodPressure || '').trim(),
  pulse: String(payload.pulse || '').trim(),
  temperature: String(payload.temperature || '').trim(),
  oxygenSaturation: String(payload.oxygenSaturation || '').trim(),
  examination: String(payload.examination || '').trim(),
  diagnosis: String(payload.diagnosis || '').trim(),
  assessment: String(payload.assessment || '').trim(),
  carePlan: String(payload.carePlan || '').trim(),
  patientInstructions: String(payload.patientInstructions || '').trim(),
  followUp: String(payload.followUp || '').trim(),
});

export async function saveSpecialtyExamDetails(user, encounterId, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(encounterId) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Yêu cầu kết quả khám không hợp lệ.');
  const details = normalizeSpecialtyResult(payload);
  const lengths = Object.values(details).map(value => value.length);
  if (details.chiefComplaint.length < 2 || details.symptoms.length < 5 || details.diagnosis.length < 2
    || details.examination.length < 5 || details.assessment.length < 5 || details.carePlan.length < 5
    || details.symptoms.length > 4000 || details.diagnosis.length > 2000
    || lengths.some(length => length > 4000) || details.bloodPressure.length > 100 || details.pulse.length > 30
    || details.temperature.length > 30 || details.oxygenSaturation.length > 30) return fail('Kiểm tra lại nội dung kết quả và dấu hiệu sinh tồn.');
  const { data: encounter, error: encounterError } = await supabase.from('clinical_encounters')
    .select('id,appointment_id,doctor_id,specialty_id,status')
    .eq('id', encounterId).maybeSingle();
  if (encounterError) return fail('Không thể tải lượt khám để lưu kết quả.', 503);
  if (!encounter || encounter.doctor_id !== access.data.doctor.id || encounter.status !== 'completed') return fail('Chỉ bác sĩ phụ trách mới được cập nhật kết quả của lượt khám đã hoàn tất.', 403);
  const { data: appointment, error: appointmentError } = await supabase.from('appointments')
    .select('id,status,checked_in_at').eq('id', encounter.appointment_id).maybeSingle();
  if (appointmentError) return fail('Không thể kiểm tra hồ sơ lượt khám.', 503);
  if (!appointment?.checked_in_at || !['confirmed', 'completed'].includes(appointment.status)) return fail('Lượt khám chưa được tiếp nhận hợp lệ.', 409);

  const { data: addenda, error: addendaError } = await supabase.from('clinical_note_addenda')
    .select('id,author_name,content,created_at').eq('appointment_id', appointment.id).order('created_at', { ascending: true });
  if (addendaError) return fail('Không thể tải lịch sử kết quả khám.', 503);
  const marker = specialtyResultMarker(encounterId);
  const revisions = (addenda || []).filter(row => String(row.content || '').startsWith(marker)).map(row => {
    try { return { ...row, details: JSON.parse(row.content.slice(marker.length)) }; } catch { return null; }
  }).filter(Boolean);
  const previous = revisions.at(-1);
  const sameDetails = previous && JSON.stringify(previous.details) === JSON.stringify(details);
  const expectedUpdatedAt = typeof payload.expectedUpdatedAt === 'string' ? payload.expectedUpdatedAt : null;
  const editMode = payload.editMode === true;
  if (editMode && (previous?.created_at || null) !== expectedUpdatedAt && !sameDetails) return fail('Kết quả đã được người khác cập nhật sau khi bạn mở biểu mẫu. Tải lại lịch khám rồi chỉnh sửa bản mới nhất.', 409);
  let saved = previous;
  if (!sameDetails) {
    const authorName = access.data.doctor.full_name || user.email || 'Bác sĩ';
    const { data: audit, error: auditError } = await supabase.from('clinical_note_addenda').insert({
      appointment_id: appointment.id, entered_by: access.data.account.id, author_name: authorName,
      content: `${marker}${JSON.stringify(details)}`,
    }).select('id,author_name,content,created_at').single();
    if (auditError) return fail('Không thể ghi lịch sử chỉnh sửa kết quả khám.', 503);
    saved = { ...audit, details };
    revisions.push(saved);
  }
  const { error: updateError } = await supabase.from('clinical_encounters').update({
    symptoms: details.symptoms, provisional_diagnosis: details.diagnosis,
  }).eq('id', encounterId).eq('doctor_id', access.data.doctor.id).eq('status', 'completed');
  if (updateError) return fail('Kết quả đã được ghi vào lịch sử nhưng chưa đồng bộ phần tóm tắt. Hãy lưu lại để đồng bộ.', 503);
  if (!sameDetails) await logAdminEvent({ actor: user, actorRole: access.data.account.role, eventType: previous ? 'clinical.specialty_result_updated' : 'clinical.specialty_result_details_recorded', entityType: 'clinical_encounter', entityId: encounterId, message: previous ? 'Chỉnh sửa kết quả khám chuyên khoa.' : 'Bổ sung nội dung kết quả khám chuyên khoa.', metadata: { specialtyId: encounter.specialty_id, revision: revisions.length } });
  return ok({ encounterId, details, authorName: saved?.author_name || access.data.doctor.full_name || 'Bác sĩ', updatedAt: saved?.created_at || null, revision: revisions.length });
}

export async function updatePatientHealthProfileFromEncounter(user, encounterId, payload = {}) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(encounterId) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Yêu cầu cập nhật hồ sơ không hợp lệ.');
  const { data: encounter, error: encounterError } = await supabase.from('clinical_encounters')
    .select('id,doctor_id,appointment_id,status,appointments(id,patient_medical_profile_id,status,checked_in_at)')
    .eq('id', encounterId).maybeSingle();
  if (encounterError) return fail('Không thể kiểm tra lượt khám chuyên khoa.', 503);
  const appointment = Array.isArray(encounter?.appointments) ? encounter.appointments[0] : encounter?.appointments;
  if (!encounter || encounter.doctor_id !== access.data.doctor.id || encounter.status !== 'completed'
    || !appointment?.patient_medical_profile_id || !appointment.checked_in_at || !['confirmed','completed'].includes(appointment.status)) {
    return fail('Chỉ bác sĩ phụ trách mới có thể cập nhật hồ sơ sau khi hoàn tất lượt khám.', 403);
  }

  const history = typeof payload.medicalHistory === 'string' ? payload.medicalHistory.trim() : '';
  const allergyStatus = String(payload.allergyStatus || 'keep');
  const allergies = typeof payload.allergies === 'string' ? payload.allergies.trim() : '';
  const bloodGroup = String(payload.bloodGroup || '');
  const bloodGroupSource = String(payload.bloodGroupSource || '');
  const bloodGroupEvidence = typeof payload.bloodGroupEvidence === 'string' ? payload.bloodGroupEvidence.trim() : '';
  const validAllergyStatuses = new Set(['keep', 'known', 'none_reported', 'unknown']);
  const validBloodGroups = new Set(['A+','A-','B+','B-','AB+','AB-','O+','O-']);
  if (history.length > 2500 || !validAllergyStatuses.has(allergyStatus) || allergies.length > 1500
    || (allergyStatus === 'known' && allergies.length < 2)
    || (bloodGroup && (!validBloodGroups.has(bloodGroup) || !['laboratory','medical_record'].includes(bloodGroupSource) || bloodGroupEvidence.length < 5 || bloodGroupEvidence.length > 300))) {
    return fail('Kiểm tra tiền sử, dị ứng và nguồn xác minh nhóm máu.');
  }
  if (!history && allergyStatus === 'keep' && !bloodGroup) return fail('Chưa có thông tin nào được chọn để cập nhật.');

  const { data: profile, error: profileError } = await supabase.from('patient_medical_profiles')
    .select('id,medical_history,allergies,blood_group')
    .eq('id', appointment.patient_medical_profile_id).maybeSingle();
  if (profileError) return fail('Không thể tải hồ sơ sức khỏe của người bệnh.', 503);
  if (!profile) return fail('Không tìm thấy hồ sơ sức khỏe đã liên kết với lượt khám.', 404);

  const date = clinicDateTime().date;
  const patch = {};
  const changedFields = [];
  const descriptions = [];
  if (history) {
    const entry = `Người bệnh khai ngày ${date}: ${history}`;
    const previousHistory = String(profile.medical_history || '');
    const updatedHistory = previousHistory.includes(entry) ? previousHistory : [previousHistory, entry].filter(Boolean).join('\n\n');
    if (updatedHistory.length > 4000) return fail('Tiền sử đã lưu quá dài. Hãy bổ sung thông tin mới ngắn gọn hơn.');
    patch.medical_history = updatedHistory;
    changedFields.push('medical_history'); descriptions.push('tiền sử bệnh do người bệnh cung cấp');
  }
  if (allergyStatus !== 'keep') {
    const entry = allergyStatus === 'known'
      ? `Người bệnh khai dị ứng: ${allergies} (${date}).`
      : allergyStatus === 'none_reported'
        ? `Người bệnh xác nhận chưa ghi nhận dị ứng (${date}).`
        : `Tình trạng dị ứng chưa xác định khi rà soát ngày ${date}.`;
    if (entry.length > 2000) return fail('Thông tin dị ứng quá dài. Hãy ghi ngắn gọn, đúng nội dung người bệnh xác nhận.');
    // Keep the profile's current allergy statement unambiguous; historical entries remain in the authored addendum.
    patch.allergies = entry;
    changedFields.push('allergies');
    descriptions.push(allergyStatus === 'known' ? 'dị ứng do người bệnh khai' : allergyStatus === 'none_reported' ? 'người bệnh xác nhận chưa ghi nhận dị ứng' : 'dị ứng chưa xác định');
  }
  if (bloodGroup) {
    patch.blood_group = bloodGroup;
    changedFields.push('blood_group');
    descriptions.push(`nhóm máu ${bloodGroup} theo ${bloodGroupSource === 'laboratory' ? 'xét nghiệm' : 'hồ sơ y tế'} (${bloodGroupEvidence})`);
  }

  const { data: updated, error: updateError } = await supabase.from('patient_medical_profiles')
    .update(patch).eq('id', profile.id).select('id,updated_at').maybeSingle();
  if (updateError || !updated) return fail('Không thể lưu thông tin sức khỏe. Kết quả chuyên khoa vẫn đã lưu; hãy thử cập nhật hồ sơ lần nữa.', 503);

  const authorName = access.data.doctor.full_name || user.email || 'Bác sĩ';
  const content = `Hồ sơ sức khỏe được cập nhật sau lượt khám chuyên khoa: ${descriptions.join('; ')}. Người cập nhật: ${authorName}. Mã lượt khám: ${encounterId}.`;
  const { error: historyError } = await supabase.from('clinical_note_addenda').insert({
    appointment_id: appointment.id, entered_by: access.data.account.id, author_name: authorName, content,
  });
  if (historyError) return fail('Hồ sơ sức khỏe đã cập nhật, nhưng chưa lưu được lịch sử người cập nhật. Hãy thử lại để hoàn tất ghi nhận.', 503);
  await logAdminEvent({ actor: user, actorRole: access.data.account.role, eventType: 'clinical.patient_health_profile_updated', entityType: 'patient_medical_profile', entityId: profile.id, message: 'Cập nhật hồ sơ sức khỏe từ lượt khám.', metadata: { encounterId, appointmentId: appointment.id, fields: changedFields } });
  return ok({ profileId: profile.id, updatedAt: updated.updated_at, historyRecorded: true });
}

export async function getDoctorReferralSlots(user, specialtyId, date) {
  const access = await ownDoctor(user);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(String(specialtyId || '')) || !validDate(date) || date !== clinicDateTime().date) {
    return fail('Ngày hoặc chuyên khoa chuyển khám không hợp lệ.');
  }
  if (specialtyId === access.data.doctor.specialty_id) return fail('Chọn một chuyên khoa khác để chuyển khám.');
  const specialty = await supabase.from('clinic_specialties').select('id,name')
    .eq('id', specialtyId).eq('clinic_owned', true).eq('is_active', true).maybeSingle();
  if (specialty.error) return fail('Không thể kiểm tra chuyên khoa tiếp nhận.', 503);
  if (!specialty.data) return fail('Không tìm thấy chuyên khoa đang hoạt động.', 404);
  const doctors = await supabase.from('doctors').select('id,full_name,specialty_id')
    .eq('specialty_id', specialtyId).eq('clinic_owned', true).eq('is_demo', false).eq('is_active', true);
  if (doctors.error) return fail('Không thể tải bác sĩ tiếp nhận.', 503);
  const doctorById = new Map((doctors.data || []).map(doctor => [doctor.id, doctor]));
  if (!doctorById.size) return ok({ specialty: specialty.data, slots: [] });
  const slots = await supabase.from('appointment_slots')
    .select('id,doctor_id,specialty_id,slot_date,start_time,end_time,capacity,booked_count,is_active')
    .in('doctor_id', [...doctorById.keys()]).eq('specialty_id', specialtyId).eq('slot_date', date)
    .eq('is_active', true).gte('start_time', clinicTime()).order('start_time');
  if (slots.error) return fail('Không thể tải khung giờ tiếp nhận.', 503);
  const ids = (slots.data || []).map(slot => slot.id);
  const referrals = ids.length
    ? await supabase.from('clinical_encounters').select('referred_slot_id').in('referred_slot_id', ids)
    : { data: [], error: null };
  if (referrals.error) return fail('Không thể kiểm tra sức chứa khung giờ.', 503);
  const reservedByReferrals = new Map();
  for (const row of referrals.data || []) reservedByReferrals.set(row.referred_slot_id, (reservedByReferrals.get(row.referred_slot_id) || 0) + 1);
  return ok({ specialty: specialty.data, slots: (slots.data || []).map(slot => ({
    ...slot,
    doctor_name: doctorById.get(slot.doctor_id)?.full_name || 'Bác sĩ',
    available_count: Math.max(0, slot.capacity - slot.booked_count - (reservedByReferrals.get(slot.id) || 0)),
  })).filter(slot => slot.available_count > 0) });
}

export async function getDoctorSchedule(user, from, to, targetDoctorId) {
  const access = await ownDoctor(user);
  return access.ok ? getAdminSchedule(user, access.data.account.role === APP_ROLES.HEAD && targetDoctorId ? targetDoctorId : access.data.doctor.id, from, to) : access;
}

export async function saveDoctorSlot(user, payload, targetDoctorId) {
  const access = await ownDoctor(user);
  return access.ok ? saveAdminSlot(user, { ...payload, doctorId: access.data.account.role === APP_ROLES.HEAD && targetDoctorId ? targetDoctorId : access.data.doctor.id }) : access;
}

export async function changeDoctorSlot(user, slotId, payload, targetDoctorId) {
  const access = await ownDoctor(user);
  return access.ok ? updateAdminSlot(user, access.data.account.role === APP_ROLES.HEAD && targetDoctorId ? targetDoctorId : access.data.doctor.id, slotId, payload) : access;
}
export { getDepartmentDoctors };
