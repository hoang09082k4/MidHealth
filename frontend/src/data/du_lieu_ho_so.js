export function chuan_hoa_so_dien_thoai(value = '') {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function chuan_hoa_cmnd_cccd(value = '') {
  return value.replace(/\D/g, '').slice(0, 12);
}

export function chuan_hoa_bhyt(value = '') {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
}

export function kiem_tra_bhyt(value = '') {
  if (!value) return true;
  return /^[A-Z]{2}\d[A-Z]{2}\d{10}$/.test(value) || /^\d{10,15}$/.test(value);
}

export function kiem_tra_ngay_sinh(value = '') {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
