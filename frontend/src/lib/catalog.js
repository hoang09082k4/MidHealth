const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const fallbackCatalog = {
  doctors: [],
  hospitals: [],
  clinics: [],
  specialties: [],
};

export async function fetchCatalog() {
  const response = await fetch(`${apiBaseUrl}/api/catalog`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải dữ liệu danh mục.');
  }

  return {
    doctors: result.data?.doctors || [],
    hospitals: result.data?.hospitals || [],
    clinics: result.data?.clinics || [],
    specialties: result.data?.specialties || [],
  };
}
