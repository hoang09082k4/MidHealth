function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isVercelHostname(hostname) {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
}

export function getApiBaseUrl() {
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;

    // Production and every Vercel preview expose the backend under /api on the
    // same origin. Avoid falling back to the visitor's localhost when a Vercel
    // environment variable is absent or still contains a local development URL.
    if (!isLocalHostname(hostname)) {
      const configuredHostname = envBaseUrl ? new URL(envBaseUrl, origin).hostname : '';
      return isVercelHostname(hostname) || !configuredHostname || isLocalHostname(configuredHostname)
        ? origin
        : envBaseUrl;
    }
  }

  return envBaseUrl || 'http://localhost:4000';
}

export const apiBaseUrl = getApiBaseUrl();
