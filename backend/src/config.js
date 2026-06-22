import fs from 'node:fs';
import path from 'node:path';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', 'backend', '.env'),
];

envPaths.filter((envPath, index) => envPaths.indexOf(envPath) === index && fs.existsSync(envPath)).forEach((envPath) => {
  const envFile = fs.readFileSync(envPath, 'utf8');

  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
});

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://midhealth.vercel.app',
  'https://mid-health.vercel.app',
  'https://midhealth.vn',
  'https://www.midhealth.vn',
];

// Firebase Web API keys identify a Firebase project and are intentionally
// public. Keep the backend aligned with the Firebase project already used by
// the browser when Vercel has not injected the optional environment aliases.
const defaultFirebaseApiKey = 'AIzaSyBfkTA39JCh8YtBkj0Iyq-cL6Oruo7jk6M';
const defaultFirebaseProjectId = 'midhealth-1c1b9';

export function pickEnv(...names) {
  return names.map((name) => process.env[name]).find((value) => String(value || '').trim()) || '';
}

export const config = {
  port: process.env.PORT || 4000,
  firebaseApiKey: pickEnv('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY') || defaultFirebaseApiKey,
  firebaseProjectId: pickEnv('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID') || defaultFirebaseProjectId,
  supabaseUrl: pickEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceRoleKey: pickEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SECRET_KEY',
  ),
  jwtSecret: pickEnv('JWT_SECRET'),
  gmailUser: pickEnv('GMAIL_USER'),
  gmailAppPassword: pickEnv('GMAIL_APP_PASSWORD'),
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 5),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowedOrigins: [
    ...defaultAllowedOrigins,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ]
    .join(',')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  paypalMode: process.env.PAYPAL_MODE || 'sandbox',
  paypalClientId: pickEnv('PAYPAL_CLIENT_ID'),
  paypalClientSecret: pickEnv('PAYPAL_CLIENT_SECRET'),
  paypalWebhookId: pickEnv('PAYPAL_WEBHOOK_ID'),
  paypalCurrency: process.env.PAYPAL_CURRENCY || 'USD',
  paypalVndToUsdRate: Number(process.env.PAYPAL_VND_TO_USD_RATE || 25000),
  paypalReturnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:4000/api/payments/paypal/return',
  paypalCancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:4000/api/payments/paypal/cancel',
  paymentPendingExpiryMinutes: Number(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || 15),
  momoEndpoint: (process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn').replace(/\/+$/, ''),
  momoPartnerCode: pickEnv('MOMO_PARTNER_CODE'),
  momoAccessKey: pickEnv('MOMO_ACCESS_KEY'),
  momoSecretKey: pickEnv('MOMO_SECRET_KEY'),
  momoPartnerName: process.env.MOMO_PARTNER_NAME || 'MidHealth',
  momoStoreId: process.env.MOMO_STORE_ID || 'MidHealthStore',
  momoReturnUrl: process.env.MOMO_RETURN_URL || 'http://localhost:4000/api/payments/momo/return',
  momoIpnUrl: process.env.MOMO_IPN_URL || 'http://localhost:4000/api/payments/momo/ipn',
  geminiApiKey: pickEnv('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
};

export function missingBackendConfig() {
  return [
    ['FIREBASE_API_KEY', config.firebaseApiKey],
    ['FIREBASE_PROJECT_ID', config.firebaseProjectId],
    ['SUPABASE_URL', config.supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseServiceRoleKey],
    ['JWT_SECRET', config.jwtSecret],
    ['GMAIL_USER', config.gmailUser],
    ['GMAIL_APP_PASSWORD', config.gmailAppPassword],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}
