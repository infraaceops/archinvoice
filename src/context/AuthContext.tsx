import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  EmailAuthProvider,
  User as FirebaseUser,
  reauthenticateWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Role, UserDoc } from '../types';
import { auth, db, functions, isFirebaseConfigured } from '../config/firebase';
import { appConfig } from '../config/app';

interface AuthContextType {
  user: UserDoc | null;
  role: Role | null;
  isAuthenticated: boolean;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  changeCredentials: (currentUsername: string, currentPassword: string, newUsername: string, newPassword: string) => Promise<void>;
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
      firebaseUser.email?.split('@')[0] ||
      (typeof profile.displayName === 'string' && profile.displayName) ||
      'User',
    username: firebaseUser.email?.split('@')[0] || '',
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

function usernameEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${appConfig.usernameAuthDomain}`;
}

function normalizedUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/.test(normalized)) {
    throw new Error('Username must be 3–32 characters and use letters, numbers, dots, underscores, or hyphens.');
  }
  return normalized;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    const firebaseAuth = auth;
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribeProfile = () => {};
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (firebaseUser) => {
        unsubscribeProfile();
        if (!active) return;
        setUser(null);
        setLoading(Boolean(firebaseUser));
        if (!firebaseUser) {
          setLoading(false);
          return;
        }
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snapshot) => {
            if (!active || firebaseAuth.currentUser?.uid !== firebaseUser.uid) return;
            setUser(mapFirebaseUser(
              firebaseUser,
              snapshot.exists() ? snapshot.data() as Record<string, unknown> : {},
            ));
            setLoading(false);
          },
          (error) => {
            console.error('Unable to watch signed-in user profile.', error);
            if (active && firebaseAuth.currentUser?.uid === firebaseUser.uid) {
              setUser(mapFirebaseUser(firebaseUser));
              setLoading(false);
            }
          },
        );
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
      unsubscribeProfile();
      unsubscribe();
    };
  }, []);

  const signInWithUsername = async (username: string, password: string): Promise<void> => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Add the Firebase client settings to your environment.');
    }
    const normalized = normalizedUsername(username);
    await signInWithEmailAndPassword(auth, usernameEmail(normalized), password);
  };

  const changeCredentials = async (
    currentUsername: string,
    currentPassword: string,
    newUsername: string,
    newPassword: string,
  ): Promise<void> => {
    if (!auth?.currentUser) throw new Error('Sign in before changing account credentials.');
    const oldUsername = normalizedUsername(currentUsername);
    const nextUsername = normalizedUsername(newUsername);
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new Error('New password must be between 12 and 128 characters.');
    }
    const currentUser = auth.currentUser;
    if (currentUser.email?.toLowerCase() !== usernameEmail(oldUsername)) {
      throw new Error('Previous username does not match the signed-in account.');
    }
    const credential = EmailAuthProvider.credential(usernameEmail(oldUsername), currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    const changeCredentials = httpsCallable<
      { newUsername: string; newPassword: string },
      { username: string }
    >(functions, 'changeAccountCredentials');
    await changeCredentials({ newUsername: nextUsername, newPassword });
    await currentUser.reload();
    await currentUser.getIdToken(true);
    await refreshUser();
  };

  const signOut = async (): Promise<void> => {
    if (!auth) throw new Error('Firebase is not configured.');
    await firebaseSignOut(auth);
  };

  const refreshUser = async (): Promise<UserDoc | null> => {
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
      signInWithUsername,
      changeCredentials,
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
