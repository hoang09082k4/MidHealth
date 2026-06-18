import { config } from '../src/config.js';

const required = [
  ['FIREBASE_API_KEY', config.firebaseApiKey],
  ['FIREBASE_PROJECT_ID', config.firebaseProjectId],
  ['SUPABASE_URL', config.supabaseUrl],
  ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseServiceRoleKey],
  ['JWT_SECRET', config.jwtSecret],
  ['GMAIL_USER', config.gmailUser],
  ['GMAIL_APP_PASSWORD', config.gmailAppPassword],
];

const optionalDemoServices = [
  ['PAYPAL_CLIENT_ID', config.paypalClientId, 'PayPal sandbox'],
  ['PAYPAL_CLIENT_SECRET', config.paypalClientSecret, 'PayPal sandbox'],
  ['MOMO_PARTNER_CODE', config.momoPartnerCode, 'MoMo sandbox'],
  ['MOMO_ACCESS_KEY', config.momoAccessKey, 'MoMo sandbox'],
  ['MOMO_SECRET_KEY', config.momoSecretKey, 'MoMo sandbox'],
  ['GEMINI_API_KEY', config.geminiApiKey, 'Gemini AI'],
];

const missingRequired = required.filter(([, value]) => !value).map(([name]) => name);
const missingOptional = optionalDemoServices.filter(([, value]) => !value);

if (missingRequired.length) {
  console.error('Missing required backend environment variables:');
  missingRequired.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

console.log('Required backend environment variables: OK');

if (missingOptional.length) {
  console.warn('Optional demo service variables are missing:');
  missingOptional.forEach(([name, , service]) => console.warn(`- ${name} (${service})`));
  console.warn('The app can run, but the listed demo integrations will report missing-config until configured.');
} else {
  console.log('Optional demo service variables: OK');
}
