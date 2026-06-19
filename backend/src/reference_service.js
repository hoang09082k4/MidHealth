import { hasSupabaseConfig, supabase } from './supabase.js';

const DEFAULT_KEYS = ['regions', 'addressData', 'ethnicGroups', 'occupations'];

const FALLBACK_REFERENCE_DATA = {
  regions: [
    { name: 'TP. Hồ Chí Minh', aliases: ['Hồ Chí Minh', 'TPHCM'], districts: ['Quận 1', 'Quận 3', 'Quận 5', 'Thủ Đức'] },
    { name: 'Thành phố Hà Nội', aliases: ['Hà Nội'], districts: ['Ba Đình', 'Hoàn Kiếm', 'Đống Đa', 'Cầu Giấy'] },
  ],
  addressData: [
    { name: 'TP. Hồ Chí Minh', districts: [{ name: 'Quận 1', wards: ['Tất cả phường/xã/khu vực'] }, { name: 'Thủ Đức', wards: ['Tất cả phường/xã/khu vực'] }] },
    { name: 'Thành phố Hà Nội', districts: [{ name: 'Ba Đình', wards: ['Tất cả phường/xã/khu vực'] }] },
  ],
  ethnicGroups: ['Kinh', 'Tày', 'Thái', 'Hoa', 'Khmer', 'Khác'],
  occupations: ['Học sinh / Sinh viên', 'Nhân viên văn phòng', 'Kinh doanh', 'Công nhân', 'Lao động tự do', 'Khác'],
};

function fallbackResult() {
  return { ok: true, status: 200, data: FALLBACK_REFERENCE_DATA };
}

export async function getReferenceData() {
  if (!hasSupabaseConfig) {
    return fallbackResult();
  }

  try {
    const { data, error } = await supabase
      .from('reference_data')
      .select('key, value')
      .in('key', DEFAULT_KEYS);

    if (error) throw error;

    const mapped = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
    return {
      ok: true,
      status: 200,
      data: {
        regions: mapped.regions || [],
        addressData: mapped.addressData || [],
        ethnicGroups: mapped.ethnicGroups || [],
        occupations: mapped.occupations || [],
      },
    };
  } catch (error) {
    return fallbackResult();
  }
}
