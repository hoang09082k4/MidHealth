import fs from 'node:fs';
import path from 'node:path';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
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

export const config = {
  port: process.env.PORT || 4000,
  firebaseApiKey: process.env.FIREBASE_API_KEY,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.JWT_SECRET,
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 5),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://midhealth.vercel.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  paypalMode: process.env.PAYPAL_MODE || 'sandbox',
  paypalClientId: process.env.PAYPAL_CLIENT_ID,
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET,
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID,
  paypalCurrency: process.env.PAYPAL_CURRENCY || 'USD',
  paypalVndToUsdRate: Number(process.env.PAYPAL_VND_TO_USD_RATE || 25000),
  paypalReturnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:4000/api/payments/paypal/return',
  paypalCancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:4000/api/payments/paypal/cancel',
  paymentPendingExpiryMinutes: Number(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || 15),
  momoEndpoint: (process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn').replace(/\/+$/, ''),
  momoPartnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
  momoAccessKey: process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85',
  momoSecretKey: process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  momoPartnerName: process.env.MOMO_PARTNER_NAME || 'MidHealth',
  momoStoreId: process.env.MOMO_STORE_ID || 'MidHealthStore',
  momoReturnUrl: process.env.MOMO_RETURN_URL || 'http://localhost:4000/api/payments/momo/return',
  momoIpnUrl: process.env.MOMO_IPN_URL || 'http://localhost:4000/api/payments/momo/ipn',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
};
