import { config } from './config.js';

const localCorsOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const vercelCorsOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export function normalizeCorsOrigin(value) {
  const origin = String(value || '').trim().replace(/\/+$/, '');
  if (!origin) return '';
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

export function isCorsOriginAllowed(origin) {
  const normalizedOrigin = normalizeCorsOrigin(origin);
  if (!normalizedOrigin) return true;
  const configuredOrigins = new Set(
    [
      ...config.allowedOrigins,
      config.frontendUrl,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    ]
      .map(normalizeCorsOrigin)
      .filter(Boolean),
  );

  return configuredOrigins.has(normalizedOrigin)
    || localCorsOriginPattern.test(normalizedOrigin)
    || vercelCorsOriginPattern.test(normalizedOrigin);
}

export function applyCorsHeaders(request, response) {
  const origin = normalizeCorsOrigin(request.headers.origin);
  const allowedOrigin = !origin ? '*' : isCorsOriginAllowed(origin) ? origin : '';

  if (allowedOrigin) response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    request.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  );
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
}
