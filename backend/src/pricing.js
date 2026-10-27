// Indicative prices are used only by the offline demonstration catalog.

export const specialtyPriceByName = {
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

export function specialtyBasePrice(specialtyName) {
  const normalizedName = normalizeVietnamese(specialtyName);
  return specialtyPriceByName[normalizedName] || 180000;
}

export function calculateAppointmentPrice({ consultationFee } = {}) {
  const originalAmount = Number(consultationFee);
  if (consultationFee === null || consultationFee === undefined || !Number.isSafeInteger(originalAmount) || originalAmount < 0) {
    throw new Error('Phí khám chưa được cấu hình hợp lệ.');
  }
  return {
    originalAmount,
    insuranceDiscount: 0,
    finalAmount: originalAmount,
    insuranceRate: 0,
    currency: 'VND',
  };
}
