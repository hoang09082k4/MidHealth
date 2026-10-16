import { requireRoles, APP_ROLES } from './authorization_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { getClinic } from './clinic_service.js';
import { clinicDateTime, validDate } from './booking_policy.js';
import { mutateClinicProfile } from './clinic_profile_store.js';

const fail = (message, status = 400) => ({ ok: false, status, data: { message } });
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
const clean = value => typeof value === 'string' ? value.trim() : '';
const integerInput = value => Number.isSafeInteger(value) || (typeof value === 'string' && /^\d+$/.test(value));
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const IMAGE_BUCKET = 'clinic-images';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const imageExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function uploadClinicCatalogImage(user, payload = {}) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN, APP_ROLES.DOCTOR, APP_ROLES.HEAD]); if (!access.ok) return access;
  if (!['doctor', 'specialty', 'clinic-logo'].includes(payload.kind)) return fail('Loại ảnh không hợp lệ.');
  if (payload.kind === 'clinic-logo' && access.data.role !== APP_ROLES.ADMIN) return fail('Chỉ admin được thay logo phòng khám.', 403);
  if ([APP_ROLES.DOCTOR, APP_ROLES.HEAD].includes(access.data.role) && payload.kind !== 'doctor') return fail('Bác sĩ chỉ được tải ảnh hồ sơ của mình.', 403);
  if (!hasSupabaseConfig) return fail('Chưa kết nối kho ảnh phòng khám.', 503);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(payload.dataUrl || '');
  if (!match) return fail('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return fail('Ảnh phải nhỏ hơn 4 MB.');
  const type = match[1];
  const validSignature = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validSignature) return fail('Tệp ảnh không hợp lệ.');
  const bucket = await supabase.storage.getBucket(IMAGE_BUCKET);
  if (bucket.error && Number(bucket.error.statusCode) !== 404) return fail('Không thể kiểm tra kho ảnh.', 503);
  if (!bucket.data) {
    const created = await supabase.storage.createBucket(IMAGE_BUCKET, { public: true });
    if (created.error && Number(created.error.statusCode) !== 409) return fail('Không thể tạo kho ảnh.', 503);
  } else if (!bucket.data.public) return fail('Kho ảnh cần được cấu hình công khai để hiển thị trên website.', 503);
  const folder = payload.kind === 'clinic-logo' ? 'clinic' : payload.kind === 'specialty' ? 'specialties' : 'doctors';
  const path = `${folder}/${crypto.randomUUID()}.${imageExtensions[type]}`;
  const uploaded = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (uploaded.error) return fail('Không thể tải ảnh lên. Vui lòng thử lại.', 503);
  return { ok: true, status: 201, data: { url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl } };
}

export function validateClinicCatalogPayload(payload) {
  if (!payload || !['doctor', 'specialty'].includes(payload.kind)) return 'Loại danh mục không hợp lệ.';
  if (payload.id && !uuid(payload.id)) return 'Mã hồ sơ không hợp lệ.';
  if (!clean(payload.name) || clean(payload.name).length > 160) return 'Tên phải có từ 1 đến 160 ký tự.';
  const textLimits = payload.kind === 'doctor'
    ? { title: 100, workplace: 160, intro: 5000, education: 500, expertise: 500, licenseNumber: 100, contactEmail: 254, contactPhone: 20, image: 2000 }
    : { image: 2000 };
  if (Object.entries(textLimits).some(([key, max]) => payload[key] !== undefined && (typeof payload[key] !== 'string' || payload[key].length > max))) return 'Thông tin danh mục vượt quá độ dài cho phép.';
  if (payload.kind === 'doctor' && !uuid(payload.specialtyId)) return 'Vui lòng chọn chuyên khoa.';
  if (payload.kind === 'doctor' && payload.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(payload.contactEmail))) return 'Email liên hệ của bác sĩ chưa hợp lệ.';
  if (payload.kind === 'doctor' && payload.contactPhone) {
    const phone = clean(payload.contactPhone);
    if (!/^\+?[\d\s().-]{9,20}$/.test(phone) || !/^\d{9,15}$/.test(phone.replace(/\D/g, ''))) return 'Số điện thoại liên hệ chưa hợp lệ.';
  }
  if (payload.kind === 'doctor' && (!validDate(payload.birthDate) || payload.birthDate > clinicDateTime().date)) return 'Nhập ngày sinh hợp lệ của bác sĩ.';
  if (payload.kind === 'doctor' && payload.yearsExperience !== '' && payload.yearsExperience !== undefined && (payload.yearsExperience === null || !integerInput(payload.yearsExperience) || Number(payload.yearsExperience) < 0 || Number(payload.yearsExperience) > 80)) return 'Số năm kinh nghiệm không hợp lệ.';
  if (payload.kind === 'doctor' && payload.consultationFee !== '' && payload.consultationFee !== undefined && (payload.consultationFee === null || !integerInput(payload.consultationFee) || Number(payload.consultationFee) < 0 || Number(payload.consultationFee) > 100000000)) return 'Phí khám không hợp lệ.';
  if (payload.image) {
    const image = clean(payload.image);
    if (/[\u0000-\u001f]/.test(image)) return 'Ảnh phải là đường dẫn nội bộ hoặc URL HTTPS hợp lệ.';
    let validImage = /^\/(?!\/)[^\\\u0000-\u001f]*$/.test(image);
    if (/^https:\/\//i.test(image)) {
      try { const url = new URL(image); validImage = url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
      catch { validImage = false; }
    }
    if (!validImage) return '\u1EA2nh ph\u1EA3i l\u00E0 \u0111\u01B0\u1EDDng d\u1EABn n\u1ED9i b\u1ED9 ho\u1EB7c URL HTTPS h\u1EE3p l\u1EC7.';
  }
  if (payload.isDemo !== undefined && typeof payload.isDemo !== 'boolean') return 'Loại dữ liệu không hợp lệ.';
  if (payload.isActive !== undefined && typeof payload.isActive !== 'boolean') return 'Trạng thái không hợp lệ.';
  if (payload.homepageOrder !== undefined && (!Number.isInteger(payload.homepageOrder) || payload.homepageOrder < 0 || payload.homepageOrder > 10000)) return 'Thứ tự trang chủ không hợp lệ.';
  if (payload.homepageFeatured !== undefined && typeof payload.homepageFeatured !== 'boolean') return 'Hiển thị trang chủ không hợp lệ.';
  if (payload.kind === 'specialty' && payload.consultationFee !== undefined && (!integerInput(payload.consultationFee) || payload.consultationFee < 0 || payload.consultationFee > 100000000)) return 'Phí khám phải là số nguyên từ 0 đến 100.000.000 đồng.';
  return '';
}

export async function getClinicCatalogAdmin(user) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN]); if (!access.ok) return access;
  if (!hasSupabaseConfig) return fail('Chưa kết nối dữ liệu phòng khám.', 503);
  const [doctors, specialties] = await Promise.all([
    supabase.from('doctors').select('id, full_name, title, specialty_id, avatar_url, intro, years_experience, consultation_fee, workplace_text, is_active, is_demo, homepage_featured, homepage_order').eq('clinic_owned', true).order('full_name'),
    supabase.from('clinic_specialties').select('id, name, image_url, is_active, consultation_fee').eq('clinic_owned', true).order('name'),
  ]);
  if (doctors.error || specialties.error) return fail('Không thể tải danh mục phòng khám.', 503);
  const { data: clinicProfile, error: profileError } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (profileError) return fail('Không thể tải thông tin liên hệ bác sĩ.', 503);
  const contacts = clinicProfile?.profile?.doctorContacts || {};
  return { ok: true, status: 200, data: { doctors: doctors.data.map(doctor => ({
    ...doctor, contact_email: contacts[doctor.id]?.email || '', contact_phone: contacts[doctor.id]?.phone || '', birth_date: contacts[doctor.id]?.birthDate || '', birth_date_estimated: contacts[doctor.id]?.birthDateEstimated === true,
    education: contacts[doctor.id]?.education || '', expertise: contacts[doctor.id]?.expertise || '', license_number: contacts[doctor.id]?.licenseNumber || '',
  })), specialties: specialties.data } };
}

export async function saveClinicCatalogEntry(user, payload) {
  const access = await requireRoles(user, [APP_ROLES.ADMIN]); if (!access.ok) return access;
  const message = validateClinicCatalogPayload(payload); if (message) return fail(message);
  if (!hasSupabaseConfig) return fail('Chưa kết nối dữ liệu phòng khám.', 503);
  const isDoctor = payload.kind === 'doctor';
  const table = isDoctor ? 'doctors' : 'clinic_specialties';
  let existing = null;
  if (payload.id) {
    const result = await supabase.from(table).select('*').eq('id', payload.id).eq('clinic_owned', true).maybeSingle();
    if (result.error) return fail('Không thể đọc hồ sơ.', 503);
    if (!result.data) return fail('Không tìm thấy hồ sơ của phòng khám.', 404);
    existing = result.data;
  }
  if (!isDoctor && existing?.is_active && payload.isActive === false) {
    const { count, error } = await supabase.from('doctors').select('id', { count: 'exact', head: true })
      .eq('clinic_owned', true).eq('specialty_id', existing.id).eq('is_active', true);
    if (error) return fail('Không thể kiểm tra bác sĩ đang thuộc chuyên khoa này.', 503);
    if (count > 0) return fail('Hãy tạm ẩn hoặc chuyển các bác sĩ đang hoạt động trước khi ẩn chuyên khoa.');
  }
  const row = { clinic_owned: true, is_active: payload.isActive ?? existing?.is_active ?? true };
  if (isDoctor) {
    const specialty = await supabase.from('clinic_specialties').select('id').eq('id', payload.specialtyId).eq('clinic_owned', true).eq('is_active', true).maybeSingle();
    if (specialty.error || !specialty.data) return fail('Chuyên khoa chưa mở tiếp nhận.');
    const clinic = await getClinic();
    Object.assign(row, { full_name: clean(payload.name), title: clean(payload.title).slice(0, 100),
      specialty_id: payload.specialtyId, intro: clean(payload.intro).slice(0, 5000),
      avatar_url: clean(payload.image) || null, workplace_text: clean(payload.workplace) || clinic.name,
      years_experience: payload.yearsExperience === '' || payload.yearsExperience === undefined ? null : Number(payload.yearsExperience),
      consultation_fee: payload.consultationFee === '' || payload.consultationFee === undefined ? null : Number(payload.consultationFee),
      homepage_featured: payload.homepageFeatured ?? existing?.homepage_featured ?? true, homepage_order: payload.homepageOrder ?? existing?.homepage_order ?? 100,
      is_demo: payload.isDemo ?? existing?.is_demo ?? false });
  } else Object.assign(row, { name: clean(payload.name), image_url: clean(payload.image) || null, consultation_fee: payload.consultationFee ?? existing?.consultation_fee ?? 180000 });
  if (!existing) row.slug = `${slug(payload.name) || payload.kind}-${crypto.randomUUID().slice(0, 8)}`;
  const query = existing ? supabase.from(table).update(row).eq('id', existing.id).eq('clinic_owned', true) : supabase.from(table).insert(row);
  const result = await query.select().single();
  if (result.error) return fail('Không thể lưu danh mục phòng khám.', 409);
  if (isDoctor) {
    const rollbackDoctor = async () => {
      if (!existing) return supabase.from('doctors').delete().eq('id', result.data.id).eq('clinic_owned', true);
      const previousValues = Object.fromEntries(Object.keys(row).filter(key => key !== 'clinic_owned').map(key => [key, existing[key]]));
      return supabase.from('doctors').update(previousValues).eq('id', existing.id).eq('clinic_owned', true);
    };
    const contactUpdate = await mutateClinicProfile(profile => {
      const doctorContacts = { ...(profile.doctorContacts || {}) };
      doctorContacts[result.data.id] = {
        ...(doctorContacts[result.data.id] || {}),
        email: clean(payload.contactEmail).toLowerCase(), phone: clean(payload.contactPhone), birthDate: payload.birthDate, birthDateEstimated: false,
        education: clean(payload.education), expertise: clean(payload.expertise), licenseNumber: clean(payload.licenseNumber),
      };
      return { ...profile, doctorContacts };
    });
    if (contactUpdate.error) {
      const rollback = await rollbackDoctor();
      return fail(rollback.error ? 'Kh\u00F4ng l\u01B0u \u0111\u01B0\u1EE3c th\u00F4ng tin li\u00EAn h\u1EC7 v\u00E0 c\u0169ng kh\u00F4ng ho\u00E0n t\u00E1c \u0111\u01B0\u1EE3c h\u1ED3 s\u01A1 b\u00E1c s\u0129; c\u1EA7n ki\u1EC3m tra d\u1EEF li\u1EC7u.' : 'Kh\u00F4ng l\u01B0u \u0111\u01B0\u1EE3c th\u00F4ng tin li\u00EAn h\u1EC7. H\u1ED3 s\u01A1 b\u00E1c s\u0129 \u0111\u00E3 \u0111\u01B0\u1EE3c ho\u00E0n t\u00E1c, vui l\u00F2ng th\u1EED l\u1EA1i.', 503);
    }
  }
  return { ok: true, status: existing ? 200 : 201, data: result.data };
}
