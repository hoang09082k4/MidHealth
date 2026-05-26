export const DAN_TOC_VIET_NAM = [
  'Kinh', 'Tày', 'Thái', 'Mường', 'Khmer', 'Hoa', 'Nùng', "H'Mông", 'Dao', 'Gia Rai',
  'Ê Đê', 'Ba Na', 'Sán Chay', 'Chăm', 'Cơ Ho', 'Xơ Đăng', 'Sán Dìu', 'Hrê', 'Raglai', 'Mnông',
  'Thổ', 'Stiêng', 'Khơ Mú', 'Bru - Vân Kiều', 'Cơ Tu', 'Giáy', 'Tà Ôi', 'Mạ', 'Gié Triêng', 'Co',
  'Chơ Ro', 'Xinh Mun', 'Kháng', 'Hà Nhì', 'Chu Ru', 'Lào', 'La Chí', 'La Ha', 'Phù Lá', 'La Hủ',
  'Lự', 'Lô Lô', 'Chứt', 'Mảng', 'Pà Thẻn', 'Cơ Lao', 'Cống', 'Bố Y', 'Si La', 'Pu Péo', 'Brâu',
  'Ơ Đu', 'Rơ Măm', 'Ngái',
];

export const NGHE_NGHIEP = [
  'Học sinh / Sinh viên', 'Nhân viên văn phòng', 'Công nhân', 'Kinh doanh', 'Nông dân',
  'Giáo viên', 'Bác sĩ / Nhân viên y tế', 'Kỹ sư', 'Lập trình viên', 'Kế toán',
  'Luật sư', 'Công chức / Viên chức', 'Quân nhân', 'Công an', 'Tài xế',
  'Đầu bếp', 'Nhân viên bán hàng', 'Lao động tự do', 'Nội trợ', 'Hưu trí',
  'Không có nghề nghiệp', 'Khác',
];

export const DIA_CHI_FALLBACK = [
  {
    name: 'Thành phố Hồ Chí Minh',
    districts: [
      { name: 'Quận Bình Thạnh', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 17', 'Phường 19', 'Phường 21', 'Phường 22', 'Phường 24', 'Phường 25', 'Phường 26', 'Phường 27', 'Phường 28'] },
      { name: 'Quận 1', wards: ['Phường Bến Nghé', 'Phường Bến Thành', 'Phường Cầu Kho', 'Phường Cầu Ông Lãnh', 'Phường Cô Giang', 'Phường Đa Kao', 'Phường Nguyễn Cư Trinh', 'Phường Nguyễn Thái Bình', 'Phường Phạm Ngũ Lão', 'Phường Tân Định'] },
      { name: 'Quận 5', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'] },
    ],
  },
  {
    name: 'Thành phố Hà Nội',
    districts: [
      { name: 'Quận Ba Đình', wards: ['Phường Cống Vị', 'Phường Điện Biên', 'Phường Đội Cấn', 'Phường Giảng Võ', 'Phường Kim Mã', 'Phường Liễu Giai', 'Phường Ngọc Hà', 'Phường Phúc Xá', 'Phường Quán Thánh', 'Phường Thành Công'] },
      { name: 'Quận Hoàn Kiếm', wards: ['Phường Chương Dương', 'Phường Cửa Đông', 'Phường Cửa Nam', 'Phường Đồng Xuân', 'Phường Hàng Bạc', 'Phường Hàng Bài', 'Phường Hàng Bồ', 'Phường Hàng Buồm', 'Phường Hàng Đào', 'Phường Tràng Tiền'] },
    ],
  },
  {
    name: 'Thành phố Đà Nẵng',
    districts: [
      { name: 'Quận Hải Châu', wards: ['Phường Bình Hiên', 'Phường Bình Thuận', 'Phường Hải Châu I', 'Phường Hải Châu II', 'Phường Hòa Cường Bắc', 'Phường Hòa Cường Nam', 'Phường Nam Dương', 'Phường Phước Ninh', 'Phường Thạch Thang', 'Phường Thuận Phước'] },
      { name: 'Quận Thanh Khê', wards: ['Phường An Khê', 'Phường Chính Gián', 'Phường Hòa Khê', 'Phường Tam Thuận', 'Phường Tân Chính', 'Phường Thạc Gián', 'Phường Thanh Khê Đông', 'Phường Thanh Khê Tây', 'Phường Vĩnh Trung', 'Phường Xuân Hà'] },
    ],
  },
];

export function chuan_hoa_so_dien_thoai(value) {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function chuan_hoa_cmnd_cccd(value) {
  return value.replace(/\D/g, '').slice(0, 12);
}

export function chuan_hoa_bhyt(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
}

export function kiem_tra_bhyt(value) {
  if (!value) return true;
  return /^[A-Z]{2}\d[A-Z]{2}\d{10}$/.test(value) || /^\d{10,15}$/.test(value);
}

export function kiem_tra_ngay_sinh(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
