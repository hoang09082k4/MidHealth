function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

const SAME_ORIGIN_HOSTS = new Set([
  'midhealth.vercel.app',
  'mid-health.vercel.app',
]);

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  if (typeof window !== 'undefined' && SAME_ORIGIN_HOSTS.has(window.location.hostname)) {
    return window.location.origin;
  }

  return normalizeBaseUrl(envBaseUrl);
}

export const apiBaseUrl = getApiBaseUrl();
