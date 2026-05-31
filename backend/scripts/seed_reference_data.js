import { config } from '../src/config.js';
import { hasSupabaseConfig, supabase } from '../src/supabase.js';

const TAT_CA_KHU_VUC = 'Tất cả khu vực';

const DAN_TOC_VIET_NAM = [
  'Kinh', 'Tày', 'Thái', 'Mường', 'Khmer', 'Hoa', 'Nùng', "H'Mông", 'Dao', 'Gia Rai',
  'Ê Đê', 'Ba Na', 'Sán Chay', 'Chăm', 'Cơ Ho', 'Xơ Đăng', 'Sán Dìu', 'Hrê', 'Raglai', 'Mnông',
  'Thổ', 'Stiêng', 'Khơ Mú', 'Bru - Vân Kiều', 'Cơ Tu', 'Giáy', 'Tà Ôi', 'Mạ', 'Giẻ Triêng', 'Co',
  'Chơ Ro', 'Xinh Mun', 'Kháng', 'Hà Nhì', 'Chu Ru', 'Lào', 'La Chí', 'La Ha', 'Phù Lá', 'La Hủ',
  'Lự', 'Lô Lô', 'Chứt', 'Mảng', 'Pà Thẻn', 'Cơ Lao', 'Cống', 'Bố Y', 'Si La', 'Pu Péo', 'Brâu',
  'Ơ Đu', 'Rơ Măm', 'Ngái',
];

const NGHE_NGHIEP = [
  'Học sinh / Sinh viên', 'Nhân viên văn phòng', 'Công nhân', 'Kinh doanh', 'Nông dân',
  'Giáo viên', 'Bác sĩ / Nhân viên y tế', 'Kỹ sư', 'Lập trình viên', 'Kế toán',
  'Luật sư', 'Công chức / Viên chức', 'Quân nhân', 'Công an', 'Tài xế',
  'Đầu bếp', 'Nhân viên bán hàng', 'Lao động tự do', 'Nội trợ', 'Hưu trí',
  'Không có nghề nghiệp', 'Khác',
];

const DIA_CHI_FALLBACK = [
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

const KHU_VUC_VIET_NAM = [
  { name: 'Thành phố Hà Nội', aliases: ['Hà Nội'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Thành phố Hồ Chí Minh', aliases: ['TP. Hồ Chí Minh', 'TP.HCM', 'Hồ Chí Minh', 'Sài Gòn'], districts: ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 7', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Thạnh', 'Bình Tân', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức', 'Bình Chánh', 'Cần Giờ', 'Củ Chi', 'Hóc Môn', 'Nhà Bè', TAT_CA_KHU_VUC] },
  { name: 'Thành phố Hải Phòng', aliases: ['Hải Phòng'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Thành phố Đà Nẵng', aliases: ['Đà Nẵng'], districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Cẩm Lệ', 'Liên Chiểu', 'Hòa Vang', TAT_CA_KHU_VUC] },
  { name: 'Thành phố Cần Thơ', aliases: ['Cần Thơ'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Thành phố Huế', aliases: ['Huế', 'Thừa Thiên Huế'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh An Giang', aliases: ['An Giang'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Bắc Ninh', aliases: ['Bắc Ninh', 'Bắc Giang'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Cà Mau', aliases: ['Cà Mau', 'Bạc Liêu'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Cao Bằng', aliases: ['Cao Bằng'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Đắk Lắk', aliases: ['Đắk Lắk', 'Phú Yên'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Điện Biên', aliases: ['Điện Biên'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Đồng Nai', aliases: ['Đồng Nai', 'Bình Phước'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Đồng Tháp', aliases: ['Đồng Tháp', 'Tiền Giang'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Gia Lai', aliases: ['Gia Lai', 'Bình Định'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Hà Tĩnh', aliases: ['Hà Tĩnh'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Hưng Yên', aliases: ['Hưng Yên', 'Thái Bình'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Khánh Hòa', aliases: ['Khánh Hòa', 'Ninh Thuận'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Lai Châu', aliases: ['Lai Châu'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Lâm Đồng', aliases: ['Lâm Đồng', 'Đắk Nông', 'Bình Thuận'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Lạng Sơn', aliases: ['Lạng Sơn'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Lào Cai', aliases: ['Lào Cai', 'Yên Bái'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Nghệ An', aliases: ['Nghệ An'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Ninh Bình', aliases: ['Ninh Bình', 'Nam Định', 'Hà Nam'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Phú Thọ', aliases: ['Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Quảng Ngãi', aliases: ['Quảng Ngãi', 'Kon Tum'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Quảng Ninh', aliases: ['Quảng Ninh'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Quảng Trị', aliases: ['Quảng Trị', 'Quảng Bình'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Sơn La', aliases: ['Sơn La'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Tây Ninh', aliases: ['Tây Ninh', 'Long An'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Thái Nguyên', aliases: ['Thái Nguyên', 'Bắc Kạn'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Thanh Hóa', aliases: ['Thanh Hóa'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Tuyên Quang', aliases: ['Tuyên Quang', 'Hà Giang'], districts: [TAT_CA_KHU_VUC] },
  { name: 'Tỉnh Vĩnh Long', aliases: ['Vĩnh Long', 'Bến Tre', 'Trà Vinh'], districts: [TAT_CA_KHU_VUC] },
];

const rows = [
  {
    key: 'regions',
    value: KHU_VUC_VIET_NAM,
    description: 'Danh sach tinh/thanh va alias phuc vu loc khu vuc.',
  },
  {
    key: 'addressData',
    value: DIA_CHI_FALLBACK,
    description: 'Du lieu dia chi dung cho ho so benh nhan.',
  },
  {
    key: 'ethnicGroups',
    value: DAN_TOC_VIET_NAM,
    description: 'Danh sach dan toc Viet Nam.',
  },
  {
    key: 'occupations',
    value: NGHE_NGHIEP,
    description: 'Danh sach nghe nghiep goi y.',
  },
];

async function main() {
  if (!hasSupabaseConfig) {
    throw new Error('Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY trong backend/.env');
  }

  console.log(`Seeding reference data to ${config.supabaseUrl}`);

  const { data, error } = await supabase
    .from('reference_data')
    .upsert(rows, { onConflict: 'key' })
    .select('key');

  if (error) throw error;
  console.log(JSON.stringify({ referenceData: data.map((item) => item.key) }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
