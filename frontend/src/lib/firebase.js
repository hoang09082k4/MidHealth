import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBfkTA39JCh8YtBkj0Iyq-cL6Oruo7jk6M',
  authDomain: 'midhealth-1c1b9.firebaseapp.com',
  projectId: 'midhealth-1c1b9',
  storageBucket: 'midhealth-1c1b9.firebasestorage.app',
  messagingSenderId: '620573602820',
  appId: '1:620573602820:web:24a4202de863356b5ff151',
  measurementId: 'G-NR4CFHZ1DS',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

if (typeof window !== 'undefined') {
  import('firebase/analytics')
    .then(({ getAnalytics, isSupported }) => isSupported().then((supported) => {
      if (supported) getAnalytics(firebaseApp);
    }))
    .catch(() => {});
}

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
