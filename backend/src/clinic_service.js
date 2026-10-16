import { hasSupabaseConfig, supabase } from './supabase.js';
import { requireRoles, APP_ROLES } from './authorization_service.js';
import { mutateClinicProfile } from './clinic_profile_store.js';

export const defaultClinic = Object.freeze({
  name: 'MidHealth',
  intro: 'Chăm sóc sức khỏe cùng đội ngũ bác sĩ của phòng khám. Chủ động đặt lịch và theo dõi lịch hẹn của bạn.',
  address: '', phone: '', email: 'cskh@midhealth.vn',
  logo: '/image_chung/favicon.svg', hours: [], socialLinks: [],
  timezone: 'Asia/Ho_Chi_Minh',
  depositPercent: 30,
});

export async function getClinic() {
  if (!hasSupabaseConfig) return { ...defaultClinic };
  const { data, error } = await supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle();
  if (error) {
    // An existing installation can render the site before applying the additive migration.
    if (['42P01', 'PGRST205'].includes(error.code)) return { ...defaultClinic };
    throw error;
  }
  const { doctorContacts: _doctorContacts, departmentManagement: _departmentManagement, ...publicProfile } = data?.profile || {};
  return { ...defaultClinic, ...publicProfile, timezone: defaultClinic.timezone };
}

export function validWorkingTime(value) {
  const text = String(value || '').trim();
  if (/^(?:nghỉ|đóng cửa|24\s*\/\s*7)$/iu.test(text)) return true;
  const ranges = text.split(/\s*[,;/]\s*/);
  if (!ranges.length || ranges.some(range => !range)) return false;
  const intervals = ranges.map(range => {
    const match = range.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [, startHour, startMinute, endHour, endMinute] = match;
    const start = Number(startHour) * 60 + Number(startMinute);
    const end = Number(endHour) * 60 + Number(endMinute);
    const validClock = (hour, minute, allowEndOfDay = false) => minute < 60 && (hour < 24 || (allowEndOfDay && hour === 24 && minute === 0));
    return validClock(Number(startHour), Number(startMinute)) && validClock(Number(endHour), Number(endMinute), true) && end > start ? { start, end } : null;
  });
  if (intervals.some(interval => !interval)) return false;
  intervals.sort((a, b) => a.start - b.start);
  return intervals.every((interval, index) => index === 0 || interval.start >= intervals[index - 1].end);
}

export function validClinicHours(hours) {
  if (!Array.isArray(hours) || hours.length > 14) return false;
  const labels = new Set();
  for (const item of hours) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.label !== 'string' || typeof item.time !== 'string' ||
      !item.label.trim() || item.label.trim().length > 100 || item.time.trim().length > 100 || !validWorkingTime(item.time)) return false;
    const label = item.label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
    if (labels.has(label)) return false;
    labels.add(label);
  }
  return true;
}

export async function saveClinic(firebaseUser, payload = {}) {
  const access = await requireRoles(firebaseUser, [APP_ROLES.ADMIN]);
  if (!access.ok) return access;
  if (!hasSupabaseConfig) return { ok: false, status: 503, data: { message: 'Chưa kết nối dữ liệu phòng khám.' } };
  const textLimits = { name: 160, intro: 5000, address: 500, phone: 20, email: 254, logo: 500 };
  for (const [key, max] of Object.entries(textLimits)) {
    if (payload[key] !== undefined && typeof payload[key] !== 'string') return { ok: false, status: 400, data: { message: 'Thông tin phòng khám không hợp lệ.' } };
    if (String(payload[key] || '').trim().length > max) return { ok: false, status: 400, data: { message: 'Thông tin phòng khám vượt quá độ dài cho phép.' } };
  }
  const profile = {};
  for (const key of Object.keys(textLimits)) profile[key] = String(payload[key] || '').trim();
  if (!profile.name || (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))) {
    return { ok: false, status: 400, data: { message: 'Tên phòng khám hoặc email không hợp lệ.' } };
  }
  if (profile.phone && (!/^\+?[\d\s().-]{9,20}$/.test(profile.phone) || !/^\d{9,15}$/.test(profile.phone.replace(/\D/g, '')))) {
    return { ok: false, status: 400, data: { message: 'Số điện thoại phòng khám chưa hợp lệ.' } };
  }
  if (profile.logo && !/^(\/[^/]|https:\/\/)/.test(profile.logo)) {
    return { ok: false, status: 400, data: { message: 'Đường dẫn logo không hợp lệ.' } };
  }
  if (profile.logo.startsWith('https://')) {
    try { const url = new URL(profile.logo); if (!url.hostname || url.username || url.password) throw new Error(); }
    catch { return { ok: false, status: 400, data: { message: 'Đường dẫn logo HTTPS chưa hợp lệ.' } }; }
  }
  if (!validClinicHours(payload.hours)) {
    return { ok: false, status: 400, data: { message: 'Mỗi ngày chỉ khai báo một lần; các khung giờ không được chồng lấn. Có thể ghi “Nghỉ” hoặc “24/7”; tối đa 14 ngày.' } };
  }
  profile.hours = payload.hours.map(item => ({ label: item.label.trim(), time: item.time.trim() }));
  if (!Array.isArray(payload.socialLinks) || payload.socialLinks.length > 8) {
    return { ok: false, status: 400, data: { message: 'Tối đa 8 liên kết mạng xã hội.' } };
  }
  profile.socialLinks = [];
  for (const item of payload.socialLinks) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.label !== 'string' || typeof item.url !== 'string' ||
        !item.label.trim() || item.label.trim().length > 100 || item.url.trim().length > 500) {
      return { ok: false, status: 400, data: { message: 'Mỗi liên kết cần có tên và địa chỉ HTTPS hợp lệ.' } };
    }
    try {
      const url = new URL(item.url.trim());
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
      profile.socialLinks.push({ label: item.label.trim(), url: url.toString() });
    } catch {
      return { ok: false, status: 400, data: { message: 'Liên kết mạng xã hội phải dùng địa chỉ HTTPS hợp lệ.' } };
    }
  }
  profile.timezone = defaultClinic.timezone;
  const depositPercent = Number(payload.depositPercent ?? defaultClinic.depositPercent);
  if (!Number.isInteger(depositPercent) || depositPercent < 1 || depositPercent > 100) {
    return { ok: false, status: 400, data: { message: 'Tỷ lệ cọc phải từ 1% đến 100%.' } };
  }
  profile.depositPercent = depositPercent;
  const saved = await mutateClinicProfile(current => ({
    ...profile,
    ...(current.doctorContacts ? { doctorContacts: current.doctorContacts } : {}),
    ...(current.departmentManagement ? { departmentManagement: current.departmentManagement } : {}),
  }));
  return saved.error ? { ok: false, status: saved.error.code === 'PROFILE_CONFLICT' ? 409 : 503, data: { message: 'Không thể lưu thông tin phòng khám; hãy tải lại và thử lại.' } }
    : { ok: true, status: 200, data: saved.data.profile };
}
