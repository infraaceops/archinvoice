import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export const SplashScreen: React.FC = () => {
  const { user, loading } = useAuth();
  const { navigateTo } = useTenant();

  useEffect(() => {
    if (!loading) {
      if (user && user.tenantId) {
        navigateTo('dashboard');
      } else if (user && !user.tenantId) {
        navigateTo('onboarding');
      } else {
        navigateTo('signin');
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.brandBadge}>
        <Text style={styles.brandBadgeText}>AI</Text>
      </View>
      <Text style={styles.title}>ArchInvoice</Text>
      <Text style={styles.subtitle}>Architecture & Interior Multi-Tenant SaaS</Text>
      <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  loader: {
    marginTop: 36,
  },
});
