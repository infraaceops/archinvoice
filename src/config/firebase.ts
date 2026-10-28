import { initializeApp, getApps, getApp, FirebaseError } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

export const getAuthDomainHint = (): string => {
  const authDomain = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim();
  if (!authDomain) return 'project-id.firebaseapp.com';
  return authDomain.includes('://') ? authDomain.replace(/^https?:\/\//, '').replace(/\/?__\/auth.*$/, '') : authDomain;
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = isFirebaseConfigured
  ? Platform.OS === 'web'
    ? FirebaseAuth.getAuth(app)
    : (() => {
        try {
          return FirebaseAuth.initializeAuth(app, {
            persistence: FirebaseAuth.getReactNativePersistence(AsyncStorage),
          });
        } catch (error) {
          if (error instanceof FirebaseError && error.code === 'auth/already-initialized') {
            return FirebaseAuth.getAuth(app);
          }
          throw error;
        }
      })()
  : null;
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
