import { APP_ROLES, requireRoles } from './authorization_service.js';
import { clinicDateTime, validDate } from './booking_policy.js';
import { supabase } from './supabase.js';

const fail = (message, status = 400) => ({ ok: false, status, data: { message } });

export async function getClinicActivityReport(user, query = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.HEAD]);
  if (!access.ok) return access;
  const today = clinicDateTime().date;
  const to = query.to || today;
  const from = query.from || new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  if (!validDate(from) || !validDate(to) || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 365) return fail('Khoảng báo cáo không hợp lệ.');
  const uuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value || ''));
  if (query.specialtyId && !uuid(query.specialtyId) || query.doctorId && !uuid(query.doctorId)) return fail('Bộ lọc báo cáo không hợp lệ.');
  let specialtyId = query.specialtyId || null;
  if (access.data.role === APP_ROLES.HEAD) {
    const doctor = await supabase.from('doctors').select('id,full_name,specialty_id').eq('id', access.data.doctor_id).eq('clinic_owned', true).maybeSingle();
    if (doctor.error || !doctor.data?.specialty_id) return fail('Không xác định được khoa của trưởng khoa.', 403);
    if (specialtyId && specialtyId !== doctor.data.specialty_id) return fail('Không thể xem báo cáo khoa khác.', 403);
    specialtyId = doctor.data.specialty_id;
  }
  if (specialtyId) {
    const specialty = await supabase.from('clinic_specialties').select('id').eq('id', specialtyId).eq('clinic_owned', true).maybeSingle();
    if (specialty.error) return fail('Không thể xác minh bộ lọc chuyên khoa.', 503);
    if (!specialty.data) return fail('Không tìm thấy chuyên khoa thuộc phòng khám.', 404);
  }
  if (query.doctorId) {
    const doctor = await supabase.from('doctors').select('id,specialty_id').eq('id', query.doctorId).eq('clinic_owned', true).maybeSingle();
    if (doctor.error) return fail('Không thể xác minh bộ lọc bác sĩ.', 503);
    if (!doctor.data) return fail('Không tìm thấy bác sĩ thuộc phòng khám.', 404);
    if (specialtyId && doctor.data.specialty_id !== specialtyId) {
      return fail(access.data.role === APP_ROLES.HEAD ? 'Không thể xem báo cáo bác sĩ thuộc khoa khác.' : 'Bác sĩ không thuộc chuyên khoa đã chọn.');
    }
  }
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const statusCounts = status => {
    let request = supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', status).gte('appointment_date', from).lte('appointment_date', to);
    if (specialtyId) request = request.eq('specialty_id', specialtyId);
    if (query.doctorId) request = request.eq('doctor_id', query.doctorId);
    return request;
  };
  const [reportResult, ...statusResults] = await Promise.all([
    supabase.rpc('clinic_activity_report', {
      from_date_value: from, to_date_value: to,
      specialty_id_value: specialtyId, doctor_id_value: query.doctorId || null,
    }),
    ...statuses.map(statusCounts),
  ]);
  if (reportResult.error || statusResults.some(result => result.error)) return fail('Không thể tải báo cáo hoạt động.', 503);
  const appointmentStatuses = Object.fromEntries(statuses.map((status, index) => [status, statusResults[index].count || 0]));
  const appointmentTotal = Object.values(appointmentStatuses).reduce((sum, value) => sum + value, 0);
  const rate = value => appointmentTotal ? Math.round(value * 1000 / appointmentTotal) / 10 : null;
  const qualityMetrics = {
    appointments: appointmentTotal,
    completed: appointmentStatuses.completed,
    completionRate: rate(appointmentStatuses.completed),
    cancellationRate: rate(appointmentStatuses.cancelled),
    noShowRate: rate(appointmentStatuses.no_show),
  };
  const { data: clinicProfile, error: clinicProfileError } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (clinicProfileError) return fail('Không thể tải chỉ số điều phối khoa.', 503);
  let tasks = clinicProfile?.profile?.departmentManagement?.tasks || [];
  if (specialtyId) tasks = tasks.filter(task => task.specialtyId === specialtyId);
  tasks = tasks.filter(task => task.createdAt && task.createdAt.slice(0, 10) >= from && task.createdAt.slice(0, 10) <= to);
  const open = tasks.filter(task => task.status !== 'done');
  const managementMetrics = {
    openHandoffs: open.filter(task => task.category === 'handoff').length,
    openQualityFollowUps: open.filter(task => ['quality', 'safety', 'complaint'].includes(task.category)).length,
    openSafetyFollowUps: open.filter(task => task.category === 'safety').length,
    complaintsToReview: open.filter(task => task.category === 'complaint').length,
    overdueTasks: open.filter(task => task.dueDate && task.dueDate < today).length,
  };
  let waitingReferrals = supabase.from('clinical_encounters').select('id', { count: 'exact', head: true }).eq('status', 'waiting');
  let oldestReferral = supabase.from('clinical_encounters').select('created_at').eq('status', 'waiting').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (specialtyId) { waitingReferrals = waitingReferrals.eq('specialty_id', specialtyId); oldestReferral = oldestReferral.eq('specialty_id', specialtyId); }
  if (query.doctorId) { waitingReferrals = waitingReferrals.eq('doctor_id', query.doctorId); oldestReferral = oldestReferral.eq('doctor_id', query.doctorId); }
  const [referralCount, oldestResult] = await Promise.all([waitingReferrals, oldestReferral]);
  if (referralCount.error || oldestResult.error) return fail('Không thể tải tình trạng chuyển khám đang chờ.', 503);
  const oldestHours = oldestResult.data?.created_at ? Math.max(0, Math.floor((Date.now() - Date.parse(oldestResult.data.created_at)) / 3600000)) : null;
  const referralMetrics = { waiting: referralCount.count || 0, oldestHours };
  return { ok: true, status: 200, data: { ...reportResult.data, appointmentStatuses, qualityMetrics, managementMetrics, referralMetrics, from, to } };
}
