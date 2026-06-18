const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const catalogCacheKey = 'midhealth_catalog_cache_v1';
const catalogCacheTtlMs = 5 * 60 * 1000;

export const fallbackCatalog = {
  doctors: [],
  hospitals: [],
  clinics: [],
  specialties: [],
};

function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const hiddenSpecialties = new Set(['di ung mien dich']);

function visibleSpecialty(name = '') {
  return !hiddenSpecialties.has(normalizeName(name));
}

function cleanSpecialtyList(items = []) {
  return items.filter((item) => visibleSpecialty(typeof item === 'string' ? item : item?.name));
}

function cleanFacilitySpecialties(items = []) {
  return items.map((item) => ({
    ...item,
    specialties: cleanSpecialtyList(item.specialties || []),
  }));
}

function normalizeCatalog(data = {}) {
  return {
    doctors: data.doctors || [],
    hospitals: cleanFacilitySpecialties(data.hospitals || []),
    clinics: cleanFacilitySpecialties(data.clinics || []),
    specialties: cleanSpecialtyList(data.specialties || []),
  };
}

function readCatalogCache() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(catalogCacheKey) || 'null');
    if (!cached?.savedAt || Date.now() - cached.savedAt > catalogCacheTtlMs) return null;
    return normalizeCatalog(cached.data || {});
  } catch {
    return null;
  }
}

function writeCatalogCache(data) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(catalogCacheKey, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage can be unavailable in private mode; catalog still works without cache.
  }
}

export async function fetchCatalog() {
  const cached = readCatalogCache();
  if (cached) return cached;

  const response = await fetch(`${apiBaseUrl}/api/catalog`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải dữ liệu danh mục.');
  }

  const catalog = normalizeCatalog(result.data || {});
  writeCatalogCache(catalog);
  return catalog;
}
