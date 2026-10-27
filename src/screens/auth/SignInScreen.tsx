import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Role } from '../../types';

export const SignInScreen: React.FC = () => {
  const { signIn, signInWithGoogle, switchRole } = useAuth();
  const { navigateTo } = useTenant();

  const [email, setEmail] = useState('shadab@archstudio.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
      navigateTo('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      navigateTo('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (role: Role) => {
    setLoading(true);
    try {
      await signIn(`demo_${role}@archstudio.com`);
      switchRole(role);
      navigateTo('dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
          <Text style={styles.title}>ArchInvoice</Text>
          <Text style={styles.subtitle}>Sign in to your architectural workspace</Text>
        </View>

        {/* Google Sign In */}
        <Button
          title="Sign in with Google"
          onPress={handleGoogleSignIn}
          variant="outline"
          size="lg"
          style={styles.googleBtn}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Credentials Form */}
        <Input
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@archfirm.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <Button
          title="Sign In"
          onPress={handleSignIn}
          loading={loading}
          size="lg"
          style={styles.signInBtn}
        />

        {/* Fast Instant Demo Test Row per Spec Roles */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Instant Demo Mode (Test Permissions):</Text>
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={[styles.demoPill, { borderColor: '#10b981' }]}
              onPress={() => handleDemoSignIn('admin')}
            >
              <Text style={[styles.demoPillText, { color: '#10b981' }]}>Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoPill, { borderColor: '#3b82f6' }]}
              onPress={() => handleDemoSignIn('architect')}
            >
              <Text style={[styles.demoPillText, { color: '#3b82f6' }]}>Architect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoPill, { borderColor: '#94a3b8' }]}
              onPress={() => handleDemoSignIn('viewer')}
            >
              <Text style={[styles.demoPillText, { color: '#64748b' }]}>Viewer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.onboardLink}
          onPress={() => navigateTo('onboarding')}
        >
          <Text style={styles.onboardLinkText}>
            Setting up a new firm? <Text style={styles.boldText}>Create Company</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  googleBtn: {
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  signInBtn: {
    marginTop: 8,
  },
  demoSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  demoPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  onboardLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  onboardLinkText: {
    fontSize: 13,
    color: '#64748b',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
});
