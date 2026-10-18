import { getClinic } from './clinic_service.js';
import { clinicDateTime, validDate } from './booking_policy.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { logAdminEvent } from './admin_audit_service.js';
import { APP_ROLES, requireRoles } from './authorization_service.js';
import { sumPaidRevenuePages } from './admin_revenue.js';
import { isFirebaseAdminConfigured, updateFirebaseUserPassword } from './firebase_admin_auth.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function todayDateValue() { return clinicDateTime().date; }

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

async function countRows(table, queryBuilder = null) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (queryBuilder) query = queryBuilder(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function fetchAdminUsers() {
  const pageSize = 200;
  const roles = ['patient', 'staff', 'doctor', 'head', 'admin'];
  const readPage = (start, includeDoctorId) => supabase.from('app_users')
    .select([
      'id', 'email', 'full_name', 'role', ...(includeDoctorId ? ['doctor_id'] : []),
      'firebase_uid', 'status', 'auth_provider', 'last_login_at', 'created_at', 'updated_at',
    ].join(', '))
    .in('role', roles)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(start, start + pageSize - 1);

  let includeDoctorId = true;
  let page;
  let error;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ({ data: page, error } = await readPage(0, includeDoctorId));
    if (error?.code !== '42703') break;
    if (error.message.includes('doctor_id') && includeDoctorId) includeDoctorId = false;
    else break;
  }
  if (error) return { data: null, error, doctorAccountsAvailable: false };

  const rows = [...(page || [])];
  let start = pageSize;
  while (page?.length === pageSize) {
    ({ data: page, error } = await readPage(start, includeDoctorId));
    if (error) return { data: null, error, doctorAccountsAvailable: includeDoctorId };
    rows.push(...(page || []));
    start += pageSize;
  }
  return { data: rows, error: null, doctorAccountsAvailable: includeDoctorId };
}

async function sumPaidRevenue() {
  return sumPaidRevenuePages(async (lastId, pageSize) => {
    let query = supabase.from('payments').select('id,amount')
      .eq('status', 'paid').order('id', { ascending: true }).limit(pageSize);
    if (lastId) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  });
}

async function fetchAdminAccount(firebaseUser) {
  return requireRoles(firebaseUser, APP_ROLES.ADMIN, {
    message: 'Tài khoản không có quyền admin.',
  });
}

export async function requireAdmin(firebaseUser) {
  return fetchAdminAccount(firebaseUser);
}

export async function getAdminDashboard(firebaseUser) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: {
        message: 'Backend chưa cấu hình Supabase. Hãy đặt SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong môi trường chạy server rồi khởi động lại.',
        code: 'SUPABASE_CONFIG_MISSING',
      },
    };
  }

  try {
    const today = todayDateValue();
    const [
      totalUsers,
      totalPatients,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      noShowAppointments,
      unpaidPayments,
      paidPayments,
      totalDoctors,
    ] = await Promise.all([
      countRows('app_users', query => query.in('role', ['patient', 'staff', 'doctor', 'head', 'admin'])),
      countRows('patient_profiles'),
      countRows('appointments'),
      countRows('appointments', (query) => query.eq('appointment_date', today)),
      countRows('appointments', (query) => query.eq('status', 'pending')),
      countRows('appointments', (query) => query.eq('status', 'no_show')),
      countRows('payments', (query) => query.neq('status', 'paid')),
      countRows('payments', (query) => query.eq('status', 'paid')),
      countRows('doctors', query => query.eq('clinic_owned', true)),
    ]);

    const revenue = await sumPaidRevenue();

    const fullAppointmentColumns = 'id, doctor_id, specialty_id, appointment_slot_id, appointment_date, appointment_time_text, patient_name, patient_phone, status, payment_status, final_amount, clinic_snapshot, checked_in_at, delay_minutes, delay_note, clinician_absent, patient_medical_profiles(date_of_birth), queue_tickets(appointment_code), doctors(full_name)';
    const basicAppointmentColumns = 'id, doctor_id, specialty_id, appointment_slot_id, appointment_date, appointment_time_text, patient_name, patient_phone, status, payment_status, final_amount, clinic_snapshot, patient_medical_profiles(date_of_birth), queue_tickets(appointment_code), doctors(full_name)';
    let appointmentColumns = fullAppointmentColumns;
    let { data: appointmentRows, error: appointmentError } = await supabase
      .from('appointments')
      .select(appointmentColumns)
      .order('created_at', { ascending: false })
      .limit(500);
    const visitWorkflowAvailable = !appointmentError;
    if (appointmentError?.code === '42703' || appointmentError?.code === 'PGRST200') {
      appointmentColumns = basicAppointmentColumns;
      ({ data: appointmentRows, error: appointmentError } = await supabase
        .from('appointments')
        .select(appointmentColumns)
        .order('created_at', { ascending: false })
        .limit(500));
    }
    if (appointmentError) throw appointmentError;
    const priorityRows = [];
    let lastPendingId = null;
    for (;;) {
      let query = supabase.from('appointments').select(appointmentColumns)
        .eq('status', 'pending').order('id', { ascending: true }).limit(500);
      if (lastPendingId) query = query.gt('id', lastPendingId);
      const { data: page, error: pendingError } = await query;
      if (pendingError) throw pendingError;
      priorityRows.push(...(page || []));
      if (!page || page.length < 500) break;
      lastPendingId = page[page.length - 1].id;
    }
    const seenAppointmentIds = new Set(priorityRows.map(item => item.id));
    appointmentRows = [...priorityRows, ...(appointmentRows || []).filter(item => !seenAppointmentIds.has(item.id))];

    const { data: userRows, error: userError, doctorAccountsAvailable } = await fetchAdminUsers();
    if (userError) throw userError;
    const { data: doctorRows, error: doctorListError } = await supabase.from('doctors')
      .select('id, full_name, specialty_id, is_active').eq('clinic_owned', true).eq('is_demo', false).order('full_name');
    if (doctorListError) throw doctorListError;

    const clinic = await getClinic();

    return {
      ok: true,
      status: 200,
      data: {
        clinic,
        admin: {
          id: admin.data.id,
          email: admin.data.email,
          fullName: admin.data.full_name,
          role: admin.data.role,
        },
        metrics: {
          totalUsers,
          totalPatients,
          totalAppointments,
          todayAppointments,
          pendingAppointments,
          noShowAppointments,
          unpaidPayments,
          paidPayments,
          revenue,
          totalDoctors,
        },
        appointments: appointmentRows || [],
        visitWorkflowAvailable,
        users: userRows || [],
        doctorAccountsAvailable,
        firebaseAdminConfigured: isFirebaseAdminConfigured(),
        doctors: doctorRows || [],
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function getAdminAuditEvents(firebaseUser, filters = {}, dependencies = {}) {
  const checkAdmin = dependencies.requireAdmin || requireAdmin;
  const client = dependencies.client || supabase;
  const admin = await checkAdmin(firebaseUser);
  if (!admin.ok) return admin;
  if (!hasSupabaseConfig && !dependencies.client) {
    return { ok: false, status: 503, data: { message: 'Chưa cấu hình cơ sở dữ liệu.' } };
  }

  const page = Math.max(1, Math.min(100000, Number.parseInt(filters.page, 10) || 1));
  const pageSize = Math.max(10, Math.min(100, Number.parseInt(filters.pageSize, 10) || 50));
  const eventType = String(filters.eventType || '').trim();
  const actorRole = String(filters.actorRole || '').trim();
  const search = String(filters.search || '').normalize('NFC').replace(/[^\p{L}\p{N}@._\-\s]/gu, ' ').trim().slice(0, 100);
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  const validDateFilter = value => !value || validDate(value);
  if (!validDateFilter(from) || !validDateFilter(to) || (from && to && from > to)) {
    return { ok: false, status: 400, data: { message: 'Khoảng ngày lọc nhật ký không hợp lệ.' } };
  }
  const allowedEventTypes = new Set([
    'user_updated', 'user_password_reset', 'appointment_status_updated', 'appointment_checked_in',
    'clinician_marked_absent', 'clinician_delay_updated', 'appointment_rescheduled',
    'appointment_received', 'appointment_cancelled_by_patient', 'appointment_cancelled_by_payment',
  ]);
  const allowedRoles = new Set(['admin', 'staff', 'doctor', 'head', 'patient', 'system']);
  if (eventType && !allowedEventTypes.has(eventType)) return { ok: false, status: 400, data: { message: 'Loại sự kiện không hợp lệ.' } };
  if (actorRole && !allowedRoles.has(actorRole)) return { ok: false, status: 400, data: { message: 'Vai trò người thực hiện không hợp lệ.' } };

  let query = client.from('admin_events').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: true });
  if (eventType) query = query.eq('event_type', eventType);
  if (actorRole) query = query.eq('actor_role', actorRole);
  if (search) {
    const pattern = `%${search.replace(/[,*()]/g, ' ')}%`;
    query = query.or(`message.ilike.${pattern},actor_email.ilike.${pattern},event_type.ilike.${pattern}`);
  }
  if (from) query = query.gte('created_at', `${from}T00:00:00+07:00`);
  if (to) {
    const nextDate = new Date(`${to}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    query = query.lt('created_at', `${nextDate.toISOString().slice(0, 10)}T00:00:00+07:00`);
  }
  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error) return { ok: false, status: 503, data: { message: 'Không thể tải nhật ký. Vui lòng thử lại.' } };
  const total = Number(count || 0);
  return { ok: true, status: 200, data: { events: data || [], page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function updateUserAsAdmin(firebaseUser, userId, payload = {}) {
  const admin = await requireAdmin(firebaseUser);
  if (!admin.ok) return admin;

  const { data: targetUser, error: targetError } = await supabase
    .from('app_users')
    .select('id, auth_provider, role')
    .eq('id', userId)
    .single();
  if (targetError) return { ok: false, status: 500, data: { message: targetError.message } };
  if (targetUser.auth_provider === 'catalog') {
    return {
      ok: false,
      status: 409,
      data: { message: 'Hồ sơ catalog nội bộ không phải tài khoản đăng nhập. Hãy quản lý trạng thái tại Danh mục y tế.' },
    };
  }
  if (['doctor', 'head'].includes(targetUser.role) && payload.role !== undefined && !['doctor', 'head'].includes(payload.role)) return { ok: false, status: 409, data: { message: 'Không đổi tài khoản bác sĩ sang vai trò khác tại đây.' } };
  if (['doctor', 'head'].includes(payload.role) && !['doctor', 'head'].includes(targetUser.role)) return { ok: false, status: 409, data: { message: 'Tài khoản bác sĩ phải liên kết hồ sơ bác sĩ.' } };

  if (userId === admin.data.id && ((payload.role && payload.role !== 'admin') || (payload.status && payload.status !== 'active'))) return { ok: false, status: 409, data: { message: 'Không thể tự khóa hoặc hạ quyền tài khoản đang quản trị.' } };
  const patch = {};
  if (payload.role !== undefined && !['patient', 'staff', 'doctor', 'head', 'admin'].includes(payload.role)) return { ok: false, status: 400, data: { message: 'Vai trò không hợp lệ.' } };
  if (['patient', 'staff', 'doctor', 'head', 'admin'].includes(payload.role)) patch.role = payload.role;
  if (['active', 'disabled', 'pending'].includes(payload.status)) patch.status = payload.status;
  if (!Object.keys(patch).length) {
    return { ok: false, status: 400, data: { message: 'Không có dữ liệu cập nhật hợp lệ.' } };
  }

  const { data, error } = await supabase
    .from('app_users')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) return { ok: false, status: 500, data: { message: error.message } };

  await logAdminEvent({
    actor: firebaseUser,
    actorRole: 'admin',
    eventType: 'user_updated',
    entityType: 'app_user',
    entityId: userId,
    message: 'Admin updated user account.',
    metadata: patch,
  });

  return { ok: true, status: 200, data };
}

export async function resetClinicUserPasswordAsAdmin(firebaseUser, userId, payload = {}, dependencies = {}) {
  const client = dependencies.client || supabase;
  const checkAdmin = dependencies.requireAdmin || requireAdmin;
  const updatePassword = dependencies.updateFirebaseUserPassword || updateFirebaseUserPassword;
  const writeAudit = dependencies.logAdminEvent || logAdminEvent;
  const admin = await checkAdmin(firebaseUser);
  if (!admin.ok) return admin;
  if (!client) return { ok: false, status: 503, data: { message: 'Backend chưa kết nối cơ sở dữ liệu.' } };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId || '')) {
    return { ok: false, status: 400, data: { message: 'Mã tài khoản không hợp lệ.' } };
  }
  const { data: account, error } = await client.from('app_users')
    .select('id,firebase_uid,email,role,auth_provider,status').eq('id', userId).maybeSingle();
  if (error) return { ok: false, status: 503, data: { message: 'Không thể đọc tài khoản cần cấp lại mật khẩu.' } };
  if (!account) return { ok: false, status: 404, data: { message: 'Không tìm thấy tài khoản.' } };
  if (!['doctor', 'head', 'staff'].includes(account.role) || account.auth_provider !== 'password') {
    return { ok: false, status: 409, data: { message: 'Chỉ hỗ trợ cấp lại mật khẩu cho tài khoản bác sĩ và nhân viên dùng email/mật khẩu.' } };
  }
  if (account.status !== 'active') {
    return { ok: false, status: 409, data: { message: 'Tài khoản đang bị khóa. Hãy xác minh và mở khóa tài khoản trước khi cấp lại mật khẩu.' } };
  }
  if (typeof account.firebase_uid !== 'string' || !account.firebase_uid.trim()) {
    return { ok: false, status: 409, data: { message: 'Tài khoản chưa được liên kết với Firebase UID. Không thể đổi mật khẩu.' } };
  }
  if (typeof account.email !== 'string' || !account.email.trim()) {
    return { ok: false, status: 409, data: { message: 'Tài khoản chưa có email đăng nhập. Không thể cấp lại mật khẩu.' } };
  }

  const password = typeof payload.password === 'string' ? payload.password : '';
  if (password.length < 8 || password.length > 128) {
    return { ok: false, status: 422, data: { message: 'Mật khẩu cần có từ 8 đến 128 ký tự.' } };
  }
  let updated;
  try {
    updated = await updatePassword(account.firebase_uid, password, { expectedEmail: account.email });
  } catch {
    return { ok: false, status: 502, data: { message: 'Backend không thể xác nhận kết quả cập nhật mật khẩu từ Firebase. Hãy kiểm tra trạng thái tài khoản trước khi thử lại.' } };
  }
  if (!updated || typeof updated.ok !== 'boolean') {
    return { ok: false, status: 502, data: { message: 'Firebase không trả kết quả cập nhật mật khẩu hợp lệ.' } };
  }
  if (!updated.ok) {
    return { ok: false, status: updated.status, data: {
      ...(updated.code ? { code: updated.code } : {}),
      ...(updated.passwordUpdated ? { passwordUpdated: true } : {}),
      ...(updated.sessionsRevoked === false ? { sessionsRevoked: false } : {}),
      message: updated.message,
    } };
  }
  try {
    await writeAudit({ actor: firebaseUser, actorRole: 'admin', eventType: 'user_password_reset',
      entityType: 'app_user', entityId: account.id, message: 'Admin reset a clinic account password.',
      metadata: { role: account.role } });
  } catch {
    console.warn('Password changed in Firebase, but the admin audit event could not be recorded.');
  }
  return { ok: true, status: 200, data: {
    email: account.email, status: account.status, sessionsRevoked: true,
    message: account.status === 'active'
      ? 'Mật khẩu đã được cập nhật trên Firebase và các phiên đăng nhập cũ đã bị thu hồi. Hãy chuyển mật khẩu mới cho đúng người dùng qua kênh riêng.'
      : 'Mật khẩu đã được cập nhật.',
  } };
}

export async function updateAppointmentAsAdmin(user, appointmentId, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!hasSupabaseConfig) return { ok: false, status: 503, data: { message: 'Chưa kết nối cơ sở dữ liệu.' } };
  if (!['confirmed', 'cancelled', 'no_show'].includes(payload.status)) return { ok: false, status: 400, data: { message: 'Trạng thái không hợp lệ. Hãy lưu kết quả khám để hoàn tất lịch.' } };
  const { data, error } = await supabase.rpc('transition_clinic_appointment', { appointment_id_value: appointmentId, doctor_id_value: null, owner_id_value: null, status_value: payload.status });
  if (error) return { ok: false, status: 409, data: { message: error.message } };
  if (!data?.length) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch hẹn.' } };
  await logAdminEvent({ actor: user, eventType: 'appointment_status_updated', entityType: 'appointment', entityId: appointmentId,
    message: `Admin changed appointment status to ${payload.status}.`, metadata: { status: payload.status } });
  return { ok: true, status: 200, data: data[0] };
}

export async function checkInAppointmentAsAdmin(user, appointmentId, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.STAFF]);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId) || typeof payload.patientName !== 'string' || !payload.patientName.trim() || !validDate(payload.birthDate) || payload.birthDate > clinicDateTime().date)
    return { ok: false, status: 400, data: { message: 'Cần đối chiếu họ tên và ngày sinh bệnh nhân.' } };
  const { data, error } = await supabase.rpc('check_in_clinic_appointment', {
    appointment_id_value: appointmentId, patient_name_value: payload.patientName.trim(),
    birth_date_value: payload.birthDate, actor_id_value: access.data.id,
  });
  if (error) return { ok: false, status: 409, data: { message: error.message === 'Patient identity does not match'
    ? 'Họ tên hoặc ngày sinh không khớp hồ sơ. Không tiếp nhận; kiểm tra giấy tờ với bệnh nhân.' : error.message } };
  if (!data?.length) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
  await logAdminEvent({ actor: user, actorRole: access.data.role, eventType: 'appointment_checked_in', entityType: 'appointment', entityId: appointmentId,
    message: 'Clinic staff checked in an appointment.' });
  return { ok: true, status: 200, data: data[0] };
}

export async function updateVisitDisruptionAsAdmin(user, appointmentId, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId) || !['delay', 'absent'].includes(payload.kind))
    return { ok: false, status: 400, data: { message: 'Yêu cầu thay đổi lịch không hợp lệ.' } };
  const minutes = Number(payload.minutes);
  if (payload.kind === 'delay' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 240))
    return { ok: false, status: 400, data: { message: 'Số phút trễ phải trong khoảng 1 đến 240.' } };
  if (payload.kind === 'delay' && typeof payload.note !== 'string') return { ok: false, status: 400, data: { message: 'Ghi chú không hợp lệ.' } };
  if (payload.kind === 'delay' && payload.note.length > 500) return { ok: false, status: 400, data: { message: 'Ghi chú tối đa 500 ký tự.' } };
  const patch = payload.kind === 'absent'
    ? { clinician_absent: true, absence_source: 'manual', delay_minutes: 0, delay_note: 'Bác sĩ vắng mặt; phòng khám sẽ liên hệ để đổi lịch hoặc hủy.' }
    : { clinician_absent: false, absence_source: null, delay_minutes: minutes, delay_note: String(payload.note || '').trim().slice(0, 500) };
  const { data, error } = await supabase.from('appointments').update(patch).eq('id', appointmentId)
    .in('status', ['pending', 'confirmed']).eq('clinician_absent', false)
    .select('id, clinician_absent, delay_minutes, delay_note').maybeSingle();
  if (error) return { ok: false, status: 409, data: { message: error.message } };
  if (!data) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch còn hiệu lực.' } };
  await logAdminEvent({ actor: user, eventType: payload.kind === 'absent' ? 'clinician_marked_absent' : 'clinician_delay_updated', entityType: 'appointment', entityId: appointmentId,
    message: payload.kind === 'absent' ? 'Admin marked clinician absent.' : 'Admin updated clinician delay.',
    metadata: payload.kind === 'absent' ? {} : { minutes } });
  return { ok: true, status: 200, data };
}

export async function rescheduleAppointmentAsAdmin(user, appointmentId, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId) || !/^[0-9a-f-]{36}$/i.test(payload.slotId || ''))
    return { ok: false, status: 400, data: { message: 'Vui lòng chọn khung giờ mới hợp lệ.' } };
  const { data, error } = await supabase.rpc('reschedule_clinic_appointment', {
    appointment_id_value: appointmentId, new_slot_id_value: payload.slotId,
  });
  if (error) return { ok: false, status: 409, data: { message: error.message === 'New slot is unavailable'
    ? 'Khung giờ mới vừa hết chỗ hoặc bác sĩ không nhận khám. Vui lòng chọn lại.' : error.message } };
  if (!data?.length) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
  await logAdminEvent({ actor: user, eventType: 'appointment_rescheduled', entityType: 'appointment', entityId: appointmentId,
    message: 'Admin rescheduled an appointment.', metadata: { slotId: payload.slotId } });
  return { ok: true, status: 200, data: data[0] };
}
