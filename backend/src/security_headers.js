function shouldApplyHsts(request) {
  const forwardedProto = String(request?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || forwardedProto.includes('https');
}

export function applySecurityHeaders(response, request = null) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-XSS-Protection', '0');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');

  if (shouldApplyHsts(request)) {
    response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}
