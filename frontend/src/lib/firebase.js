import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBfkTA39JCh8YtBkj0Iyq-cL6Oruo7jk6M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'midhealth-1c1b9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'midhealth-1c1b9',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:620573602820:web:24a4202de863356b5ff151',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export function signInWithGoogleRedirect() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  return signInWithRedirect(firebaseAuth, googleProvider);
}

export function signInWithGooglePopup() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(firebaseAuth, googleProvider);
}

export function getGoogleRedirectResult() {
  return getRedirectResult(firebaseAuth);
}
