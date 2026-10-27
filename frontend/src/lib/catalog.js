import { defaultClinic } from './clinic';
import { apiBaseUrl } from './api_base';

export const catalogCacheKey = 'midhealth_catalog_cache_single_clinic_v9';
const catalogCacheTtlMs = 5 * 60 * 1000;

export const referenceSpecialties = [
  { id: 'noi-tong-quat', slug: 'noi-tong-quat', name: 'Nội tổng quát', image: 'Noitongquat.webp' },
  { id: 'nhi-khoa', slug: 'nhi-khoa', name: 'Nhi khoa', image: 'Nhikhoa.webp' },
  { id: 'san-phu-khoa', slug: 'san-phu-khoa', name: 'Sản phụ khoa', image: 'sanphukhoa.webp' },
  { id: 'da-lieu', slug: 'da-lieu', name: 'Da liễu', image: 'Dalieu.webp' },
  { id: 'tai-mui-hong', slug: 'tai-mui-hong', name: 'Tai - Mũi - Họng', image: 'taimuihong.webp' },
  { id: 'dinh-duong', slug: 'dinh-duong', name: 'Dinh dưỡng', image: 'Dinhduong.webp' },
  { id: 'kham-tong-quat', slug: 'kham-tong-quat', name: 'Khám tổng quát', image: 'Noitongquat.webp' },
];

const unavailableNotice = 'Không thể kết nối dữ liệu phòng khám. Danh sách bác sĩ và lịch đặt sẽ hiện lại khi kết nối cơ sở dữ liệu được khôi phục.';

export const fallbackCatalog = {
  source: 'unavailable',
  bookingAvailable: false,
  doctors: [],
  clinic: defaultClinic,
  services: [],
  specialties: referenceSpecialties,
  notice: unavailableNotice,
};

function normalizeCatalog(data = {}) {
  const specialties = Array.isArray(data.specialties) ? data.specialties : [];
  const noLiveSpecialties = specialties.length === 0;
  const unavailable = data.source === 'unavailable' || noLiveSpecialties;
  return {
    doctors: (Array.isArray(data.doctors) ? data.doctors : [])
      .map(doctor => unavailable ? { ...doctor, bookable: false } : doctor),
    clinic: { ...defaultClinic, ...data.clinic },
    specialties: noLiveSpecialties ? referenceSpecialties : specialties,
    services: unavailable ? [] : (Array.isArray(data.services) ? data.services : []),
    source: unavailable ? 'unavailable' : (data.source || 'database'),
    bookingAvailable: unavailable ? false : data.bookingAvailable !== false,
    notice: unavailable ? (data.notice || unavailableNotice) : (data.notice || ''),
  };
}

function offlineCatalog(catalog) {
  return { ...catalog, source: 'cached', bookingAvailable: false,
    doctors: catalog.doctors.map(doctor => ({ ...doctor, bookable: false })),
    notice: 'Đang hiển thị dữ liệu bác sĩ đã lưu trước đó; không thể đặt lịch khi chưa kết nối được với phòng khám.' };
}

function readCatalogCache({ allowExpired = false } = {}) {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(catalogCacheKey) || 'null');
    if (!cached?.savedAt || (!allowExpired && Date.now() - cached.savedAt > catalogCacheTtlMs)) return null;
    const catalog = normalizeCatalog(cached.data || {});
    if (!catalog.specialties.length && !catalog.doctors.length) return null;
    return catalog;
  } catch {
    return null;
  }
}

function writeCatalogCache(data) {
  if (typeof window === 'undefined') return;
  if (!data.specialties.length && !data.doctors.length) return;
  try {
    window.sessionStorage.setItem(catalogCacheKey, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage can be unavailable in private mode; catalog still works without cache.
  }
}

export async function fetchCatalog({ force = false } = {}) {
  const cached = readCatalogCache();
  if (cached && !force) return cached;
  const staleCatalog = readCatalogCache({ allowExpired: true });

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/catalog`, { signal: AbortSignal.timeout(15000) });
  } catch {
    if (staleCatalog) return offlineCatalog(staleCatalog);
    throw new Error(unavailableNotice);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    if (staleCatalog) return offlineCatalog(staleCatalog);
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.');
  }

  if (!response.ok) {
    if (staleCatalog) return offlineCatalog(staleCatalog);
    throw new Error(result.message || unavailableNotice);
  }

  const catalog = normalizeCatalog(result.data || {});
  if (catalog.source === 'unavailable' && staleCatalog) return offlineCatalog(staleCatalog);
  if (catalog.source === 'database') writeCatalogCache(catalog);
  return catalog;
}
