import { upsertAppUser } from '../src/account_service.js';
import { loginWithEmail, registerWithEmail } from '../src/firebase_auth.js';
import { hasSupabaseConfig } from '../src/supabase.js';

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = '123456';
const ADMIN_NAME = 'MidHealth Admin';

async function getOrCreateFirebaseUser() {
  const registerResult = await registerWithEmail({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    fullName: ADMIN_NAME,
  });

  if (registerResult.ok) {
    return {
      ...registerResult.data,
      email: ADMIN_EMAIL,
      displayName: ADMIN_NAME,
      emailVerified: true,
    };
  }

  const code = String(registerResult.data?.code || '');
  if (!code.includes('EMAIL_EXISTS')) {
    throw new Error(registerResult.data?.message || 'Khong the tao tai khoan Firebase admin.');
  }

  const loginResult = await loginWithEmail({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (!loginResult.ok) {
    throw new Error('Email admin da ton tai nhung khong dang nhap duoc bang mat khau 123456.');
  }

  return {
    ...loginResult.data,
    email: ADMIN_EMAIL,
    displayName: loginResult.data.displayName || ADMIN_NAME,
    emailVerified: true,
  };
}

async function main() {
  if (!hasSupabaseConfig) {
    throw new Error('Thieu cau hinh Supabase trong env backend.');
  }

  const firebaseUser = await getOrCreateFirebaseUser();
  const result = await upsertAppUser(firebaseUser, {
    role: 'admin',
    allowRoleChange: true,
    status: 'active',
    fullName: ADMIN_NAME,
    email: ADMIN_EMAIL,
    authProvider: 'password',
    emailVerified: true,
    markLogin: true,
  });

  if (!result.ok) {
    throw new Error(result.data?.message || 'Khong the luu app_users admin.');
  }

  console.log(`Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
