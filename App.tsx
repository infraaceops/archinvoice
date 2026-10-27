import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { TenantProvider } from './src/context/TenantContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <TenantProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </TenantProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
