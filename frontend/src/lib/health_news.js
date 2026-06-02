const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function request(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải dữ liệu Tin Y tế.');
  }

  return result.data;
}

export function fetchHealthCategories() {
  return request('/api/health-news/categories');
}

export function fetchHealthArticles({ category, limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  return request(`/api/health-news/articles?${params.toString()}`);
}

export function fetchFeaturedHealthArticles(limit = 8) {
  return request(`/api/health-news/featured?limit=${limit}`);
}

export function fetchHealthArticle(identifier) {
  return request(`/api/health-news/articles/${encodeURIComponent(identifier)}`);
}

export function searchHealthArticles({ keyword, category, limit = 30 } = {}) {
  const params = new URLSearchParams();
  params.set('q', keyword || '');
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  return request(`/api/health-news/search?${params.toString()}`);
}

export function fetchHealthExperts() {
  return request('/api/health-news/experts');
}
