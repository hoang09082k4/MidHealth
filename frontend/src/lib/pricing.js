export const STANDARD_HEALTH_INSURANCE_RATE = 0.8;

const specialtyPriceByName = {
  'Nhi khoa': 180000,
  'So sinh': 180000,
  'Dinh duong': 160000,
  'Nhiem': 180000,
  'Noi': 180000,
  'Ung buou - Huyet hoc': 250000,
  'Tai Mui Hong': 190000,
  'Gan - Mat - Tuy': 230000,
  'Ho hap': 190000,
  'Ngoai tong hop': 220000,
  'Than - Noi tiet': 220000,
  'Tam ly': 250000,
  'Noi tong quat': 180000,
  'Ngoai tong quat': 220000,
  'Tim mach': 230000,
  'San phu khoa': 220000,
  'Da lieu': 190000,
  'Xet nghiem': 150000,
  'Chan thuong chinh hinh': 240000,
  'Huyet hoc': 220000,
  'Chan doan hinh anh': 200000,
  'Rang - Ham - Mat': 220000,
  'Nha khoa tong quat': 200000,
  'Phau thuat ham mat': 280000,
  'Chinh nha': 260000,
  'Y hoc co truyen': 180000,
  'Phuc hoi chuc nang': 200000,
  'Co xuong khop': 220000,
};

export function normalizeVietnamese(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function specialtyBasePrice(specialtyName) {
  return specialtyPriceByName[normalizeVietnamese(specialtyName)] || 180000;
}

export function calculateAppointmentPrice(specialtyName, hasStandardInsurance = false) {
  const originalAmount = specialtyBasePrice(specialtyName);
  const insuranceDiscount = hasStandardInsurance
    ? Math.round(originalAmount * STANDARD_HEALTH_INSURANCE_RATE)
    : 0;
  const finalAmount = Math.max(originalAmount - insuranceDiscount, 0);
  return { originalAmount, insuranceDiscount, finalAmount };
}
