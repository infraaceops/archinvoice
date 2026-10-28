import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Role, UserDoc } from '../types';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { appConfig, buildApiUrl } from '../config/app';

interface AuthContextType {
  user: UserDoc | null;
  role: Role | null;
  isAuthenticated: boolean;
  loading: boolean;
  signInWithGoogle: (idToken?: string, returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<UserDoc | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseUser(firebaseUser: FirebaseUser, profile: Record<string, unknown> = {}): UserDoc {
  const profileRole = profile.role;
  const role: Role | null =
    profileRole === 'admin' ||
    profileRole === 'architect' ||
    profileRole === 'viewer' ||
    profileRole === 'client'
      ? profileRole
      : null;
  return {
    uid: firebaseUser.uid,
    displayName:
      (typeof profile.displayName === 'string' && profile.displayName) ||
      firebaseUser.displayName ||
      firebaseUser.email ||
      'User',
    email: firebaseUser.email || '',
    photoUrl:
      (typeof profile.photoUrl === 'string' && profile.photoUrl) ||
      firebaseUser.photoURL ||
      undefined,
    tenantId: typeof profile.tenantId === 'string' ? profile.tenantId : null,
    role,
    createdAt:
      typeof profile.createdAt === 'string'
        ? profile.createdAt
        : firebaseUser.metadata.creationTime || new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadCloudflareSession = async (): Promise<UserDoc | null> => {
    if (!appConfig.apiBaseUrl) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the deployed Cloudflare Worker URL.');
    const response = await fetch(buildApiUrl('/api/auth/session'), { credentials: 'include' });
    if (!response.ok) throw new Error(`Unable to verify your sign-in session (${response.status}).`);
    const result = await response.json() as { user: UserDoc | null };
    return result.user;
  };

  const loadProfile = async (firebaseUser: FirebaseUser): Promise<UserDoc> => {
    if (!isFirebaseConfigured) {
      return mapFirebaseUser(firebaseUser);
    }
    const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
    return mapFirebaseUser(
      firebaseUser,
      snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {}
    );
  };

  useEffect(() => {
    if (appConfig.authProvider === 'cloudflare') {
      let active = true;
      void loadCloudflareSession()
        .then((sessionUser) => {
          if (active) setUser(sessionUser);
        })
        .catch((error: unknown) => {
          console.error('Unable to verify the Cloudflare sign-in session.', error);
          if (active) setUser(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    let active = true;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          const nextUser = firebaseUser ? await loadProfile(firebaseUser) : null;
          if (active) setUser(nextUser);
        } catch (error) {
          console.error('Unable to load signed-in user profile.', error);
          if (active && firebaseUser) setUser(mapFirebaseUser(firebaseUser));
        } finally {
          if (active) setLoading(false);
        }
      },
      (error) => {
        console.error('Firebase authentication state listener failed.', error);
        if (active) {
          setUser(null);
          setLoading(false);
        }
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (idToken?: string, returnTo = '/'): Promise<void> => {
    if (appConfig.authProvider === 'cloudflare') {
      if (typeof window === 'undefined') {
        throw new Error('Cloudflare Google sign-in is currently available in the web app only.');
      }
      if (!appConfig.apiBaseUrl) {
        throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the deployed Cloudflare Worker URL.');
      }
      const startUrl = new URL(buildApiUrl('/auth/google/start'));
      startUrl.searchParams.set('returnTo', returnTo);
      window.location.assign(startUrl.toString());
      return;
    }
    if (!isFirebaseConfigured || !auth) {
      const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
      const hint = authDomain.includes('.firebaseapp.com') || authDomain.includes('.web.app')
        ? 'Use the exact Firebase project authDomain and matching Google OAuth web client.'
        : 'Use your Firebase project authDomain, such as archinvoice-50551.firebaseapp.com.';
      throw new Error(`Firebase is not configured. ${hint}`);
    }
    const provider = new GoogleAuthProvider();
    if (idToken) {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } else if (typeof window !== 'undefined') {
      await signInWithPopup(auth, provider);
    } else {
      throw new Error('Google sign-in requires a Google ID token on this device.');
    }
  };

  const signOut = async (): Promise<void> => {
    if (appConfig.authProvider === 'cloudflare') {
      const response = await fetch(buildApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error(`Unable to sign out (${response.status}).`);
      setUser(null);
      return;
    }
    if (!auth) throw new Error('Firebase is not configured.');
    await firebaseSignOut(auth);
  };

  const refreshUser = async (): Promise<UserDoc | null> => {
    if (appConfig.authProvider === 'cloudflare') {
      const refreshedUser = await loadCloudflareSession();
      setUser(refreshedUser);
      return refreshedUser;
    }
    if (!auth) {
      setUser(null);
      return null;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setUser(null);
      return null;
    }
    const refreshedUser = await loadProfile(firebaseUser);
    setUser(refreshedUser);
    return refreshedUser;
  };

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      isAuthenticated: Boolean(user),
      loading,
      signInWithGoogle,
      signOut,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
