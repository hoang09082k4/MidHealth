import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const TAT_CA_PHUONG_XA = 'Tất cả phường/xã/khu vực';

const VIETNAM_PROVINCES_2025 = [
  'Thành phố Hà Nội',
  'Thành phố Hải Phòng',
  'Thành phố Huế',
  'Thành phố Đà Nẵng',
  'Thành phố Cần Thơ',
  'Thành phố Hồ Chí Minh',
  'Tỉnh Lai Châu',
  'Tỉnh Điện Biên',
  'Tỉnh Sơn La',
  'Tỉnh Lạng Sơn',
  'Tỉnh Quảng Ninh',
  'Tỉnh Thanh Hóa',
  'Tỉnh Nghệ An',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Cao Bằng',
  'Tỉnh Tuyên Quang',
  'Tỉnh Lào Cai',
  'Tỉnh Thái Nguyên',
  'Tỉnh Phú Thọ',
  'Tỉnh Bắc Ninh',
  'Tỉnh Hưng Yên',
  'Tỉnh Ninh Bình',
  'Tỉnh Quảng Trị',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Gia Lai',
  'Tỉnh Đắk Lắk',
  'Tỉnh Khánh Hòa',
  'Tỉnh Lâm Đồng',
  'Tỉnh Đồng Nai',
  'Tỉnh Tây Ninh',
  'Tỉnh Đồng Tháp',
  'Tỉnh An Giang',
  'Tỉnh Vĩnh Long',
  'Tỉnh Cà Mau',
];

const FALLBACK_ADDRESS_DATA = VIETNAM_PROVINCES_2025.map((name) => ({
  name,
  districts: [
    {
      name: TAT_CA_PHUONG_XA,
      wards: [TAT_CA_PHUONG_XA],
    },
  ],
}));

const FALLBACK_REGIONS = VIETNAM_PROVINCES_2025.map((name) => ({
  name,
  aliases: [name.replace(/^Thành phố |^Tỉnh /, '')],
  districts: [TAT_CA_PHUONG_XA],
}));

const FALLBACK_ETHNIC_GROUPS = [
  'Kinh', 'Tày', 'Thái', 'Mường', 'Khmer', 'Hoa', 'Nùng', "H'Mông", 'Dao', 'Gia Rai',
  'Ê Đê', 'Ba Na', 'Sán Chay', 'Chăm', 'Cơ Ho', 'Xơ Đăng', 'Sán Dìu', 'Hrê', 'Raglai', 'Mnông',
  'Thổ', 'Stiêng', 'Khơ Mú', 'Bru - Vân Kiều', 'Cơ Tu', 'Giáy', 'Tà Ôi', 'Mạ', 'Giẻ Triêng', 'Co',
  'Chơ Ro', 'Xinh Mun', 'Kháng', 'Hà Nhì', 'Chu Ru', 'Lào', 'La Chí', 'La Ha', 'Phù Lá', 'La Hủ',
  'Lự', 'Lô Lô', 'Chứt', 'Mảng', 'Pà Thẻn', 'Cơ Lao', 'Cống', 'Bố Y', 'Si La', 'Pu Péo', 'Brâu',
  'Ơ Đu', 'Rơ Măm', 'Ngái',
];

const FALLBACK_OCCUPATIONS = [
  'Học sinh / Sinh viên',
  'Nhân viên văn phòng',
  'Công nhân',
  'Kinh doanh',
  'Nông dân',
  'Giáo viên',
  'Bác sĩ / Nhân viên y tế',
  'Kỹ sư',
  'Lập trình viên',
  'Kế toán',
  'Luật sư',
  'Công chức / Viên chức',
  'Quân nhân',
  'Công an',
  'Tài xế',
  'Lao động tự do',
  'Nội trợ',
  'Hưu trí',
  'Không có nghề nghiệp',
  'Khác',
];

export const fallbackReferenceData = {
  regions: FALLBACK_REGIONS,
  addressData: FALLBACK_ADDRESS_DATA,
  ethnicGroups: FALLBACK_ETHNIC_GROUPS,
  occupations: FALLBACK_OCCUPATIONS,
};

function withFallback(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

export async function fetchReferenceData() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/reference-data`);

    if (!response.ok) {
      throw new Error(`Không tải được dữ liệu tham chiếu: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data || {};

    return {
      regions: withFallback(data.regions, fallbackReferenceData.regions),
      addressData: withFallback(data.addressData, fallbackReferenceData.addressData),
      ethnicGroups: withFallback(data.ethnicGroups, fallbackReferenceData.ethnicGroups),
      occupations: withFallback(data.occupations, fallbackReferenceData.occupations),
    };
  } catch (error) {
    console.error(error);
    return fallbackReferenceData;
  }
}

const ReferenceDataContext = createContext(fallbackReferenceData);

export function ReferenceDataProvider({ children }) {
  const [referenceData, setReferenceData] = useState(fallbackReferenceData);

  useEffect(() => {
    let isMounted = true;

    fetchReferenceData().then((data) => {
      if (isMounted) {
        setReferenceData(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(() => referenceData, [referenceData]);

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  return useContext(ReferenceDataContext);
}
