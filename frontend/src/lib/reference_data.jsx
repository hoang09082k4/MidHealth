import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from './api_base';

const FALLBACK_ADDRESS_DATA = [];
const FALLBACK_REGIONS = [];

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
  let addressData = FALLBACK_ADDRESS_DATA;
  let regions = FALLBACK_REGIONS;
  try {
    const { default: units } = await import('../data/vietnam_admin_units_2026.json');
    addressData = units.map((province) => ({
      code: province.Code,
      name: province.FullName,
      aliases: [province.Name, province.FullName],
      districts: province.Wards.map((ward) => ({
        code: ward.Code,
        name: ward.FullName,
        kind: ward.AdministrativeUnitShortName,
        wards: [],
      })),
    }));
    regions = units.map((province) => ({ name: province.FullName, aliases: [province.Name], districts: [] }));
  } catch { /* Continue with API data when the local list is unavailable. */ }
  try {
    const response = await fetch(`${apiBaseUrl}/api/reference-data`);

    if (!response.ok) {
      throw new Error(`Không tải được dữ liệu tham chiếu: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data || {};

    return {
      regions: regions.length ? regions : withFallback(data.regions, regions),
      addressData,
      ethnicGroups: withFallback(data.ethnicGroups, fallbackReferenceData.ethnicGroups),
      occupations: withFallback(data.occupations, fallbackReferenceData.occupations),
    };
  } catch {
    return { ...fallbackReferenceData, regions, addressData };
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
