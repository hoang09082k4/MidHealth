function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  if (typeof window !== 'undefined' && window.location.hostname === 'midhealth.vercel.app') {
    return window.location.origin;
  }

  return normalizeBaseUrl(envBaseUrl);
}

export const apiBaseUrl = getApiBaseUrl();
