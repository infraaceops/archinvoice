import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Role, UserDoc } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { MOCK_USER } from '../services/mockData';

interface AuthContextType {
  user: UserDoc | null;
  role: Role | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  switchRole: (newRole: Role) => void;
  signOut: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserDoc | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load stored user or set default mock session
    const storedUser = offlineStorage.loadUser();
    setUser(storedUser);
    setLoading(false);
  }, []);

  const signIn = async (email?: string) => {
    const defaultUser: UserDoc = {
      ...MOCK_USER,
      email: email || MOCK_USER.email,
    };
    setUser(defaultUser);
    offlineStorage.saveUser(defaultUser);
  };

  const signInWithGoogle = async () => {
    // Google sign-in flow
    setUser(MOCK_USER);
    offlineStorage.saveUser(MOCK_USER);
  };

  const switchRole = (newRole: Role) => {
    if (!user) return;
    const updatedUser: UserDoc = { ...user, role: newRole };
    setUser(updatedUser);
    offlineStorage.saveUser(updatedUser);
  };

  const signOut = async () => {
    setUser(null);
    offlineStorage.saveUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        loading,
        signIn,
        signInWithGoogle,
        switchRole,
        signOut,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
