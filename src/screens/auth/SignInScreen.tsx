import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { isFirebaseConfigured } from '../../config/firebase';

export const SignInScreen: React.FC = () => {
  const { signInWithUsername, refreshUser } = useAuth();
  const { navigateTo } = useTenant();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const finishSignIn = async () => {
    const account = await refreshUser();
    if (account?.tenantId) navigateTo('dashboard');
    else navigateTo('dashboard');
  };

  const handleSignIn = async () => {
    if (!username.trim() || !password) {
      showToast('Enter your username and password.', { type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await signInWithUsername(username, password);
      await finishSignIn();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Sign-in failed.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoHeader}>
          <View style={styles.badge}><Text style={styles.badgeText}>AI</Text></View>
          <Text style={styles.title}>ABS Invoice</Text>
          <Text style={styles.subtitle}>Sign in with your username or email and password</Text>
        </View>
        <Input
          label="Username or email"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          editable={!loading}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          editable={!loading}
          onSubmitEditing={() => void handleSignIn()}
        />
        <Button
          title="Sign in"
          onPress={handleSignIn}
          loading={loading}
          disabled={!isFirebaseConfigured}
          size="lg"
          style={styles.signInBtn}
        />
        {!isFirebaseConfigured && (
          <Text style={styles.configurationMessage}>
            Authentication is not configured. Add the Firebase client settings to your environment.
          </Text>
        )}
        <Text style={styles.notice}>
          After signing in, set up your company profile to start creating projects and invoices.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, elevation: 8 },
  logoHeader: { alignItems: 'center', marginBottom: 24 },
  badge: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeText: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' },
  signInBtn: { marginBottom: 12 },
  configurationMessage: { fontSize: 12, lineHeight: 18, color: '#b91c1c', textAlign: 'center', marginTop: 5 },
  notice: { color: '#64748b', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
