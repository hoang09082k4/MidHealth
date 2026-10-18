import { hasSupabaseConfig, supabase } from './supabase.js';
import { requireRoles, APP_ROLES } from './authorization_service.js';
import { clinicDateTime, validDate, isFutureBooking } from './booking_policy.js';
import { logAdminEvent } from './admin_audit_service.js';
const ok = (data, status = 200) => ({ ok: true, status, data });
const fail = (message, status = 400) => ({ ok: false, status, data: { message } });
async function doctorAccess(user, doctorId) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.DOCTOR, APP_ROLES.HEAD]); if (!access.ok) return access;
  if (access.data.role === APP_ROLES.DOCTOR && access.data.doctor_id !== doctorId) return fail('Không thể truy cập lịch của bác sĩ khác.', 403);
  if (!hasSupabaseConfig) return fail('Chưa kết nối dữ liệu phòng khám.', 503);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(doctorId || '')) return fail('Vui lòng chọn bác sĩ.');
  const { data, error } = await supabase.from('doctors').select('*').eq('id', doctorId).eq('clinic_owned', true).maybeSingle();
  if (error) return fail('Không thể đọc hồ sơ bác sĩ.', 503);
  if (!data) return fail('Không tìm thấy bác sĩ của phòng khám.', 404);
  if (access.data.role === APP_ROLES.HEAD) {
    const head = await supabase.from('doctors').select('specialty_id').eq('id', access.data.doctor_id).eq('clinic_owned', true).maybeSingle();
    if (head.error) return fail('Không thể xác minh chuyên khoa trưởng khoa.', 503);
    if (!head.data?.specialty_id || data.specialty_id !== head.data.specialty_id) return fail('Trưởng khoa chỉ được quản lý lịch bác sĩ thuộc chuyên khoa của mình.', 403);
  }
  return ok({ doctor: data });
}
export async function getDepartmentDoctors(user) {
  const access = await requireRoles(user, [APP_ROLES.HEAD]); if (!access.ok) return access;
  if (!hasSupabaseConfig || !access.data.doctor_id) return fail('Tài khoản Trưởng khoa chưa được liên kết hồ sơ bác sĩ.', 403);
  const head = await supabase.from('doctors').select('specialty_id').eq('id', access.data.doctor_id).eq('clinic_owned', true).maybeSingle();
  if (head.error) return fail('Không thể xác minh chuyên khoa trưởng khoa.', 503);
  if (!head.data?.specialty_id) return fail('Tài khoản trưởng khoa chưa được liên kết chuyên khoa.', 403);
  const { data, error } = await supabase.from('doctors').select('id,full_name,specialty_id,clinic_specialties(name)').eq('clinic_owned', true).eq('is_demo', false).eq('is_active', true).eq('specialty_id', head.data.specialty_id).order('full_name');
  return error ? fail('Không thể tải danh sách bác sĩ của chuyên khoa.', 503) : ok({ doctors: (data || []).map(doctor => ({ ...doctor, specialty_name: doctor.clinic_specialties?.name || '' })) });
}
export async function getAdminSchedule(user, doctorId, fromDate, toDate) {
  const access = await doctorAccess(user, doctorId); if (!access.ok) return access;
  const from = fromDate || clinicDateTime().date;
  const to = toDate || new Date(new Date(from + 'T00:00:00Z').getTime() + 30 * 86400000).toISOString().slice(0, 10);
  if (!validDate(from) || !validDate(to) || to < from || (new Date(to) - new Date(from)) / 86400000 > 93) return fail('Chọn khoảng ngày tối đa 93 ngày.');
  const { data, error } = await supabase.from('appointment_slots').select('*').eq('doctor_id', doctorId).gte('slot_date', from).lte('slot_date', to).order('slot_date').order('start_time').limit(1000);
  if (error) return fail('Không thể tải khung giờ.', 503);
  const ids = (data || []).map(slot => slot.id);
  const referrals = ids.length
    ? await supabase.from('clinical_encounters').select('referred_slot_id').in('referred_slot_id', ids)
    : { data: [], error: null };
  if (referrals.error) return fail('Không thể kiểm tra lượt chuyển đang giữ chỗ.', 503);
  const referredCountBySlot = new Map();
  for (const row of referrals.data || []) referredCountBySlot.set(row.referred_slot_id, (referredCountBySlot.get(row.referred_slot_id) || 0) + 1);
  const mappedSlots = (data || []).map(slot => ({
    ...slot,
    referral_count: referredCountBySlot.get(slot.id) || 0,
    total_booked_count: slot.booked_count + (referredCountBySlot.get(slot.id) || 0),
  }));
  return ok({ doctor: access.data.doctor, slots: mappedSlots });
}
export async function saveAdminSlot(user, payload = {}) {
  return writeSlot(user, payload.doctorId, null, payload);
}
export async function updateAdminSlot(user, doctorId, slotId, payload = {}) {
  return writeSlot(user, doctorId, slotId, payload);
}
async function writeSlot(user, doctorId, slotId, payload) {
  const role = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.HEAD]); if (!role.ok) return role;
  const access = await doctorAccess(user, doctorId); if (!access.ok) return access;
  const doctor = access.data.doctor;
  let existing;
  if (slotId) {
    const result = await supabase.from('appointment_slots').select('*').eq('id', slotId).eq('doctor_id', doctor.id).maybeSingle();
    if (result.error) return fail(result.error.message, 500);
    existing = result.data; if (!existing) return fail('Không tìm thấy khung giờ.', 404);
  }
  let referralCount = 0;
  if (existing) {
    const referrals = await supabase.from('clinical_encounters').select('id', { count: 'exact', head: true }).eq('referred_slot_id', existing.id);
    if (referrals.error) return fail('Không thể kiểm tra lượt chuyển đang giữ chỗ.', 503);
    referralCount = referrals.count || 0;
  }
  if (existing && payload.isActive === false && Object.keys(payload).length === 1) {
    const { data, error } = await supabase.from('appointment_slots').update({ is_active: false }).eq('id', slotId).eq('doctor_id', doctor.id).select().single();
    if (error) return fail('Không thể đóng khung giờ.', 409);
    await logAdminEvent({ actor: user, actorRole: role.data.role, eventType: 'schedule.slot_closed', entityType: 'appointment_slot', entityId: slotId, message: 'Đóng khung giờ nhận đặt khám.', metadata: { doctorId: doctor.id, specialtyId: doctor.specialty_id, slotDate: data.slot_date } });
    return ok(data);
  }
  if (!doctor.is_active) return fail('Không thể mở hoặc chỉnh sửa lịch cho bác sĩ đang tạm ẩn.', 409);
  const date = payload.date || existing?.slot_date;
  const start = String(payload.startTime || existing?.start_time || '').slice(0, 5);
  const end = String(payload.endTime || existing?.end_time || '').slice(0, 5);
  const capacity = Number(payload.capacity ?? existing?.capacity ?? 1);
  if (!isFutureBooking(date, start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) return fail('Ngày, giờ hoặc sức chứa không hợp lệ.');
  if (doctor.unavailable_from && date >= doctor.unavailable_from && date <= doctor.unavailable_to) return fail('Bác sĩ nghỉ trong ngày này.');
  const usedCapacity = (existing?.booked_count || 0) + referralCount;
  if (existing && usedCapacity > 0 && (date !== existing.slot_date || start !== existing.start_time.slice(0, 5) || end !== existing.end_time?.slice(0, 5) || capacity < usedCapacity)) return fail('Khung giờ có lịch hẹn hoặc lượt chuyển, không thể đổi thời gian hoặc giảm sức chứa dưới số đang giữ chỗ.', 409);
  const row = { doctor_id: doctor.id, specialty_id: doctor.specialty_id, slot_date: date, start_time: start, end_time: end, capacity, is_active: payload.isActive ?? existing?.is_active ?? true };
  const result = slotId ? await supabase.from('appointment_slots').update(row).eq('id', slotId).eq('doctor_id', doctor.id).select().single()
    : await supabase.from('appointment_slots').insert(row).select().single();
  if (result.error) return fail(result.error.message, 409);
  await logAdminEvent({ actor: user, actorRole: role.data.role, eventType: slotId ? 'schedule.slot_updated' : 'schedule.slot_created', entityType: 'appointment_slot', entityId: result.data.id, message: slotId ? 'Cập nhật khung giờ làm việc.' : 'Mở khung giờ nhận đặt khám.', metadata: { doctorId: doctor.id, specialtyId: doctor.specialty_id, slotDate: date, capacity } });
  return ok(result.data);
}

export async function updateAdminUnavailability(user, doctorId, payload = {}) {
  const admin = await requireRoles(user, [APP_ROLES.ADMIN]); if (!admin.ok) return admin;
  const access = await doctorAccess(user, doctorId); if (!access.ok) return access;
  const enabled = payload.enabled !== false;
  if (enabled && (!validDate(payload.startDate) || !validDate(payload.endDate) || payload.endDate < payload.startDate)) return fail('Khoảng ngày nghỉ không hợp lệ.');
  if (enabled && payload.startDate < clinicDateTime().date) return fail('Ngày bắt đầu nghỉ không được ở quá khứ.');
  if (enabled && typeof payload.reason !== 'string') return fail('Ghi chú ngày nghỉ không hợp lệ.');
  if (enabled && payload.reason.length > 500) return fail('Ghi chú ngày nghỉ tối đa 500 ký tự.');
  const note = enabled ? 'Nghỉ từ ' + payload.startDate + ' đến ' + payload.endDate + '. ' + String(payload.reason || '') : '';
  const { data, error } = await supabase.rpc('set_clinic_doctor_absence', {
    doctor_id_value: access.data.doctor.id, enabled_value: enabled,
    start_date_value: enabled ? payload.startDate : null, end_date_value: enabled ? payload.endDate : null,
    reason_value: note,
  });
  return error ? fail(error.message, 500) : ok(data?.[0]);
}
