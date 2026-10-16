import { defaultClinic } from './clinic';
import { apiBaseUrl } from './api_base';

export const catalogCacheKey = 'midhealth_catalog_cache_single_clinic_v7';
const catalogCacheTtlMs = 5 * 60 * 1000;

export const fallbackCatalog = {
  source: 'unavailable',
  bookingAvailable: false,
  doctors: [],
  clinic: defaultClinic,
  services: [],
  specialties: [],
};

function normalizeCatalog(data = {}) {
  return {
    doctors: data.doctors || [],
    clinic: { ...defaultClinic, ...data.clinic },
    specialties: data.specialties || [],
    services: data.services || [],
    source: data.source || 'database',
    bookingAvailable: data.bookingAvailable !== false,
    notice: data.notice || '',
  };
}

function readCatalogCache() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(catalogCacheKey) || 'null');
    if (!cached?.savedAt || Date.now() - cached.savedAt > catalogCacheTtlMs) return null;
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

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/catalog`, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Không thể kết nối đến phòng khám. Vui lòng kiểm tra mạng và thử lại.');
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.');
  }

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải thông tin phòng khám. Vui lòng thử lại sau.');
  }

  const catalog = normalizeCatalog(result.data || {});
  if (catalog.source === 'database') writeCatalogCache(catalog);
  return catalog;
}
