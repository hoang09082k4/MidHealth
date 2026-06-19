import { apiBaseUrl } from './api_base';

async function request(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Không thể tải dữ liệu Tin Y tế.');
  }

  return result.data;
}

export function fetchHealthCategories() {
  return request('/api/health/categories');
}

export function fetchHealthArticles({ category, keyword, featured, limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (keyword) params.set('keyword', keyword);
  if (featured !== undefined) params.set('featured', String(featured));
  if (limit) params.set('limit', String(limit));
  return request(`/api/health/articles?${params.toString()}`);
}

export function fetchFeaturedHealthArticles(limit = 8) {
  return fetchHealthArticles({ featured: true, limit });
}

export function fetchHealthArticle(identifier) {
  return request(`/api/health/articles/${encodeURIComponent(identifier)}`);
}

export function searchHealthArticles({ keyword, category, limit = 30 } = {}) {
  const params = new URLSearchParams();
  params.set('q', keyword || '');
  if (category) params.set('category', category);
  if (limit) params.set('limit', String(limit));
  return request(`/api/health/search?${params.toString()}`);
}

export function fetchHealthExperts() {
  return request('/api/health/experts');
}
