import { APP_ROLES, requireRoles } from './authorization_service.js';
import { deleteNewFirebaseAccount, registerWithEmail } from './firebase_auth.js';
import { doctorLoginEmail } from './doctor_login_email.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createDoctorAccount(adminUser, payload = {}) {
  const access = await requireRoles(adminUser, [APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!hasSupabaseConfig) return { ok: false, status: 503, data: { message: 'Chưa kết nối cơ sở dữ liệu.' } };
  const doctorId = String(payload.doctorId || '');
  const password = String(payload.password || '');
  if (payload.role !== undefined && !['doctor', 'head'].includes(payload.role)) return { ok: false, status: 400, data: { message: 'Vai trò bác sĩ không hợp lệ.' } };
  if (password.length < 8 || password.length > 128) return { ok: false, status: 400, data: { message: 'Mật khẩu cần có từ 8 đến 128 ký tự.' } };
  const accountRole = payload.role === 'head' ? 'head' : 'doctor';
  if (!uuidPattern.test(doctorId))
    return { ok: false, status: 400, data: { message: 'Chọn bác sĩ hợp lệ.' } };

  const { data: doctor, error: doctorError } = await supabase.from('doctors')
    .select('id, full_name, is_active, is_demo, clinic_owned')
    .eq('id', doctorId).eq('clinic_owned', true).maybeSingle();
  if (doctorError) return { ok: false, status: 503, data: { message: 'Không thể kiểm tra hồ sơ bác sĩ.' } };
  if (!doctor || !doctor.is_active || doctor.is_demo) return { ok: false, status: 400, data: { message: 'Chỉ tạo tài khoản cho bác sĩ thực tế đang hoạt động.' } };
  const { data: clinicProfile, error: profileError } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (profileError) return { ok: false, status: 503, data: { message: 'Không thể đọc ngày sinh bác sĩ.' } };
  const birthDate = clinicProfile?.profile?.doctorContacts?.[doctorId]?.birthDate;
  const email = doctorLoginEmail(doctor.full_name, birthDate?.slice(0, 4));
  if (!email) return { ok: false, status: 400, data: { message: 'Cần nhập ngày sinh trong hồ sơ bác sĩ trước khi tạo tài khoản.' } };
  const { data: existing, error: existingError } = await supabase.from('app_users').select('id')
    .eq('email', email).limit(1);
  const { data: linked, error: linkedError } = await supabase.from('app_users').select('id')
    .eq('doctor_id', doctorId).limit(1);
  if (linkedError || linked?.length) return { ok: false, status: linkedError ? 503 : 409, data: { message: 'Bác sĩ này đã có tài khoản hoặc không thể kiểm tra tài khoản.' } };
  if (existingError) return { ok: false, status: 503, data: { message: 'Không thể kiểm tra tài khoản hiện có.' } };
  if (existing?.length) return { ok: false, status: 409, data: { message: 'Email hoặc bác sĩ này đã có tài khoản.' } };

  // Show the generated password only in the successful admin response.
  const created = await registerWithEmail({ email, password, fullName: doctor.full_name });
  if (!created.ok) return { ok: false, status: created.status, data: created.data };
  const firebaseUid = created.data?.localId;
  if (!firebaseUid) return { ok: false, status: 503, data: { message: 'Firebase không trả về mã tài khoản.' } };
  const { data: account, error: saveError } = await supabase.from('app_users').insert({
    firebase_uid: firebaseUid, email, full_name: doctor.full_name, role: accountRole, doctor_id: doctor.id,
    status: 'active', auth_provider: 'password', email_verified: false,
  }).select('id,email,full_name,role,doctor_id,status').single();
  if (saveError) {
    await deleteNewFirebaseAccount(created.data.idToken).catch(() => {});
    return { ok: false, status: 409, data: { message: 'Không thể liên kết tài khoản với bác sĩ. Vui lòng kiểm tra lại.' } };
  }
  return { ok: true, status: 201, data: { ...account,
    password,
    message: 'Đã tạo tài khoản bác sĩ. Hãy chuyển thông tin đăng nhập qua kênh riêng cho bác sĩ.',
  } };
}
