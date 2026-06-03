const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

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

export async function fetchCatalog() {
  const response = await fetch(`${apiBaseUrl}/api/catalog`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải dữ liệu danh mục.');
  }

  return {
    doctors: result.data?.doctors || [],
    hospitals: cleanFacilitySpecialties(result.data?.hospitals || []),
    clinics: cleanFacilitySpecialties(result.data?.clinics || []),
    specialties: cleanSpecialtyList(result.data?.specialties || []),
  };
}
