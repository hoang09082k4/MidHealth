function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getApiBaseUrl() {
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (isLocalHostname(hostname) && window.location.port === '4000') return origin;

    // The production Node server serves the frontend and API on one origin.
    // Ignore a stale local development URL on a public deployment.
    if (!isLocalHostname(hostname)) {
      const configuredHostname = envBaseUrl ? new URL(envBaseUrl, origin).hostname : '';
      return !configuredHostname || isLocalHostname(configuredHostname)
        ? origin
        : envBaseUrl;
    }
  }

  return envBaseUrl || 'http://localhost:4000';
}

export const apiBaseUrl = getApiBaseUrl();
