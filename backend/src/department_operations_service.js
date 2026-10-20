import { randomUUID } from 'node:crypto';
import { APP_ROLES, requireRoles } from './authorization_service.js';
import { clinicDateTime, validDate } from './booking_policy.js';
import { logAdminEvent } from './admin_audit_service.js';
import { mutateClinicProfile } from './clinic_profile_store.js';
import { supabase } from './supabase.js';

const fail = (message, status = 400) => ({ ok: false, status, data: { message } });
const ok = data => ({ ok: true, status: 200, data });
const statuses = new Set(['open', 'in_progress', 'blocked', 'done']);
const categories = new Set(['coordination', 'handoff', 'quality', 'safety', 'complaint']);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);

async function getHeadContext(user) {
  const access = await requireRoles(user, [APP_ROLES.HEAD, APP_ROLES.DOCTOR]);
  if (!access.ok) return access;
  if (!access.data.doctor_id) return fail('Tài khoản trưởng khoa chưa được liên kết hồ sơ.', 403);
  const { data: head, error } = await supabase.from('doctors')
    .select('id,specialty_id,clinic_specialties(name)')
    .eq('id', access.data.doctor_id).eq('clinic_owned', true).maybeSingle();
  if (error || !head?.specialty_id) return fail('Không xác định được chuyên khoa phụ trách.', 403);
  return ok({ account: access.data, head });
}

async function readTeam(specialtyId) {
  const { data, error } = await supabase.from('doctors')
    .select('id,full_name,is_active')
    .eq('clinic_owned', true).eq('is_active', true).eq('is_demo', false)
    .eq('specialty_id', specialtyId).order('full_name');
  return error ? { error } : { team: data || [] };
}

async function mutateTasks(mutator) {
  let outcome;
  const saved = await mutateClinicProfile(profile => {
    const state = profile.departmentManagement || {};
    const current = Array.isArray(state.tasks) ? state.tasks : [];
    outcome = mutator(current);
    if (!outcome.ok) throw Object.assign(new Error(outcome.data.message), { status: outcome.status });
    return { ...profile, departmentManagement: { ...state, tasks: outcome.tasks } };
  });
  if (saved.error) return fail(saved.error.message, saved.error.status || (saved.error.code === 'PROFILE_CONFLICT' ? 409 : 503));
  return ok(outcome.data);
}

export async function getDepartmentOperations(user) {
  const context = await getHeadContext(user);
  if (!context.ok) return context;
  const { data: clinic, error } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (error || !clinic) return fail('Không thể tải dữ liệu điều phối của khoa.', 503);
  const isHead = context.data.account.role === APP_ROLES.HEAD;
  const roster = isHead ? await readTeam(context.data.head.specialty_id) : { team: [] };
  if (roster.error) return fail('Không thể tải danh sách bác sĩ trong khoa.', 503);
  let tasks = (clinic.profile?.departmentManagement?.tasks || []).filter(task => task.specialtyId === context.data.head.specialty_id);
  if (!isHead) tasks = tasks.filter(task => task.assigneeId === context.data.head.id);
  const audit = isHead ? await supabase.from('admin_events').select('event_type,entity_type,entity_id,actor_email,message,metadata,created_at')
    .contains('metadata', { specialtyId: context.data.head.specialty_id })
    .order('created_at', { ascending: false }).limit(100) : { data: [], error: null };
  if (audit.error) return fail('Không thể tải lịch sử thao tác của khoa.', 503);
  return ok({ specialtyName: context.data.head.clinic_specialties?.name || '', doctors: roster.team,
    tasks: [...tasks].sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')),
    auditEvents: audit.data || [],
  });
}

export async function createDepartmentTask(user, payload = {}) {
  const context = await getHeadContext(user);
  if (!context.ok) return context;
  if (context.data.account.role !== APP_ROLES.HEAD) return fail('Chỉ trưởng khoa được giao công việc.', 403);
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const category = payload.category || 'coordination';
  const priority = payload.priority || 'normal';
  const dueDate = payload.dueDate || null;
  const assigneeId = payload.assigneeId || null;
  if (title.length < 4 || title.length > 140 || description.length > 1200 || !categories.has(category) || !priorities.has(priority) || !dueDate || !validDate(dueDate) || dueDate < clinicDateTime().date || !assigneeId) {
    return fail('Thông tin công việc không hợp lệ.');
  }
  let assigneeName = '';
  if (assigneeId) {
    const roster = await readTeam(context.data.head.specialty_id);
    if (roster.error) return fail('Không thể xác minh người được giao.', 503);
    const assignee = roster.team.find(item => item.id === assigneeId);
    if (!assignee) return fail('Chỉ có thể giao việc cho bác sĩ đang hoạt động trong khoa.', 403);
    assigneeName = assignee.full_name;
  }
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(), specialtyId: context.data.head.specialty_id, title, description, category, priority, dueDate, assigneeId, assigneeName,
    status: 'open', createdAt: now, updatedAt: now,
    createdBy: context.data.account.full_name || context.data.account.email || 'Trưởng khoa',
    history: [{ status: 'open', at: now, by: context.data.account.full_name || context.data.account.email || 'Trưởng khoa' }],
  };
  const saved = await mutateTasks(tasks => tasks.length >= 250
    ? fail('Khoa đã đạt giới hạn 250 công việc đang lưu.', 409)
    : { ok: true, tasks: [task, ...tasks], data: task });
  if (!saved.ok) return saved;
  await logAdminEvent({ actor: user, actorRole: 'head', eventType: 'department_task.created', entityType: 'department_task', entityId: task.id, message: 'Trưởng khoa tạo công việc điều phối.', metadata: { specialtyId: context.data.head.specialty_id, category, priority, assigneeId } });
  return saved;
}

export async function updateDepartmentTask(user, taskId, payload = {}) {
  const context = await getHeadContext(user);
  if (!context.ok) return context;
  if (!/^[0-9a-f-]{36}$/i.test(String(taskId || ''))) return fail('Mã công việc không hợp lệ.');
  const status = payload.status;
  if (!statuses.has(status)) return fail('Trạng thái công việc không hợp lệ.');
  const actor = context.data.account.full_name || context.data.account.email || 'Trưởng khoa';
  const now = new Date().toISOString();
  const saved = await mutateTasks(tasks => {
    const index = tasks.findIndex(item => item.id === taskId && item.specialtyId === context.data.head.specialty_id);
    if (index < 0) return fail('Không tìm thấy công việc.', 404);
    if (context.data.account.role !== APP_ROLES.HEAD && tasks[index].assigneeId !== context.data.head.id) return fail('Chỉ có thể cập nhật công việc được giao cho bạn.', 403);
    const task = { ...tasks[index], status, updatedAt: now,
      history: [...(tasks[index].history || []), { status, at: now, by: actor }].slice(-30) };
    const next = [...tasks]; next[index] = task;
    return { ok: true, tasks: next, data: task };
  });
  if (!saved.ok) return saved;
  await logAdminEvent({ actor: user, actorRole: context.data.account.role, eventType: 'department_task.status_changed', entityType: 'department_task', entityId: taskId, message: 'Cập nhật trạng thái công việc của khoa.', metadata: { specialtyId: context.data.head.specialty_id, status } });
  return saved;
}
