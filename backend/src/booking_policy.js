export const CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function clinicDateTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isFutureBooking(date, time, now = new Date()) {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(time))) return false;
  const current = clinicDateTime(now);
  return `${date}T${time.length === 5 ? time + ':00' : time}` > `${current.date}T${current.time}`;
}

export function resolveConsultationFee(doctorFee, specialtyFee) {
  const value = doctorFee == null || (typeof doctorFee === 'string' && doctorFee.trim() === '') ? specialtyFee : doctorFee;
  if (value == null || value === '') return null;
  const fee = Number(value);
  return Number.isSafeInteger(fee) && fee >= 0 ? fee : null;
}

export function validateBookingPatient(patient = {}, now = new Date()) {
  if (!patient || typeof patient !== 'object' || Array.isArray(patient)) return 'Hồ sơ bệnh nhân không hợp lệ.';
  if (typeof (patient.fullName || patient.name) !== 'string' || !(patient.fullName || patient.name).trim()) return 'Vui lòng nhập họ tên bệnh nhân.';
  if (!/^0\d{9}$/.test(String(patient.phone || '').trim())) return 'Số điện thoại bệnh nhân không hợp lệ.';
  const birth = String(patient.birthDate || patient.dateOfBirth || patient.date_of_birth || '');
  const match = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = match ? `${match[3]}-${match[2]}-${match[1]}` : birth;
  if (!validDate(date) || date > clinicDateTime(now).date) return 'Ngày sinh bệnh nhân không hợp lệ.';
  if (patient.email && (typeof patient.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email.trim()))) return 'Email bệnh nhân không hợp lệ.';
  return '';
}
