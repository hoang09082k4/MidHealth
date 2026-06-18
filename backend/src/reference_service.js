import { hasSupabaseConfig, supabase } from './supabase.js';

const DEFAULT_KEYS = ['regions', 'addressData', 'ethnicGroups', 'occupations'];

export async function getReferenceData() {
  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình Supabase.' },
    };
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
    return {
      ok: false,
      status: 500,
      data: {
        message: 'Không thể tải dữ liệu danh mục từ Supabase.',
        detail: error.message,
      },
    };
  }
}
