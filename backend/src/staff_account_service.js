import { APP_ROLES, requireRoles } from './authorization_service.js';
import { deleteNewFirebaseAccount, registerWithEmail } from './firebase_auth.js';
import { supabase } from './supabase.js';

export async function createStaffAccount(adminUser, payload = {}) {
  const access = await requireRoles(adminUser, APP_ROLES.ADMIN);
  if (!access.ok) return access;
  const email = String(payload.email || '').trim().toLowerCase();
  const fullName = String(payload.fullName || '').trim();
  const password = String(payload.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || fullName.length < 2 || fullName.length > 120 || password.length < 8 || password.length > 128) {
    return { ok: false, status: 400, data: { message: 'Kiểm tra họ tên, email và mật khẩu (mật khẩu cần từ 8 đến 128 ký tự).' } };
  }
  const existing = await supabase.from('app_users').select('id').eq('email', email).maybeSingle();
  if (existing.error) return { ok: false, status: 503, data: { message: 'Không thể kiểm tra tài khoản.' } };
  if (existing.data) return { ok: false, status: 409, data: { message: 'Email đã được sử dụng.' } };
  const created = await registerWithEmail({ email, password, fullName });
  if (!created.ok) return created;
  const { data, error } = await supabase.from('app_users').insert({
    firebase_uid: created.data.localId, email, full_name: fullName, role: APP_ROLES.STAFF,
    status: 'active', auth_provider: 'password', email_verified: false,
  }).select('id,email,full_name,role,status').single();
  if (error) {
    await deleteNewFirebaseAccount(created.data.idToken).catch(() => {});
    return { ok: false, status: 409, data: { message: 'Không thể tạo tài khoản nhân viên.' } };
  }
  return { ok: true, status: 201, data: { ...data, password } };
}
