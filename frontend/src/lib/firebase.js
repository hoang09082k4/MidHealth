import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD_I5u2Zad8ZiVzhT3J_86gK4VnERmdy30',
  authDomain: 'midhof-c36fa.firebaseapp.com',
  projectId: 'midhof-c36fa',
  storageBucket: 'midhof-c36fa.firebasestorage.app',
  messagingSenderId: '935367903965',
  appId: '1:935367903965:web:e022a65f7889dbb2fb2934',
  measurementId: 'G-6WHSKR02Y4',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(firebaseApp);
    }
  });
}

export function signInWithGoogle() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(firebaseAuth, googleProvider);
}
