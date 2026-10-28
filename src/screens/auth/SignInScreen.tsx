import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/Button';
import { isFirebaseConfigured } from '../../config/firebase';
import { appConfig } from '../../config/app';

WebBrowser.maybeCompleteAuthSession();

export const SignInScreen: React.FC = () => {
  const { signInWithGoogle, refreshUser } = useAuth();
  const { navigateTo, currentParams } = useTenant();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const hasPlatformOAuthClient =
    Platform.OS === 'web' ||
    (Platform.OS === 'ios' ? Boolean(iosClientId) : Boolean(androidClientId));
  const isCloudflareWebAuth =
    appConfig.authProvider === 'cloudflare' &&
    Platform.OS === 'web' &&
    Boolean(appConfig.apiBaseUrl);
  const signInAvailable = isCloudflareWebAuth || isFirebaseConfigured;
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId || 'web-oauth-client-not-configured.apps.googleusercontent.com',
    iosClientId: iosClientId || 'ios-oauth-client-not-configured.apps.googleusercontent.com',
    androidClientId: androidClientId || 'android-oauth-client-not-configured.apps.googleusercontent.com',
    selectAccount: true,
  });

  const finishSignIn = async () => {
    const account = await refreshUser();
    if (account?.tenantId) navigateTo('dashboard');
    else if (currentParams?.inviteToken) {
      navigateTo('join_company', {
        inviteToken: currentParams.inviteToken,
        tenantId: currentParams.tenantId,
      });
    }
    else navigateTo('create_company');
  };

  const showConfigIssue = () => {
    if (appConfig.authProvider === 'cloudflare') {
      showToast(
        Platform.OS !== 'web'
          ? 'Cloudflare Google sign-in is currently available in the web app only.'
          : 'Set EXPO_PUBLIC_API_BASE_URL to the deployed Cloudflare Worker URL.',
        { type: 'error' },
      );
      return;
    }
    const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
    const hasDomain = authDomain.includes('.firebaseapp.com') || authDomain.includes('.web.app');
    if (!hasDomain) {
      showToast('Fix Firebase authDomain: use your project hostname only, such as archinvoice-50551.firebaseapp.com', { type: 'error' });
      return;
    }
    showToast('Google sign-in is unavailable because Firebase is not configured correctly for this domain.', { type: 'error' });
  };

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setLoading(false);
      showToast(response.error?.message || 'Google sign-in was not completed.', { type: 'error' });
      return;
    }
    if (response.type !== 'success') {
      setLoading(false);
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) {
      setLoading(false);
      showToast('Google did not return an ID token. Check OAuth client configuration.', { type: 'error' });
      return;
    }
    void signInWithGoogle(idToken)
      .then(finishSignIn)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Google sign-in failed.', { type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!signInAvailable) {
      showConfigIssue();
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const returnTo = currentParams?.inviteToken && currentParams?.tenantId
          ? `/?invite=${encodeURIComponent(currentParams.inviteToken)}&tenantId=${encodeURIComponent(currentParams.tenantId)}`
          : '/';
        await signInWithGoogle(undefined, returnTo);
        await finishSignIn();
        setLoading(false);
        return;
      }
      if (!request) {
        showToast('Google sign-in is still initializing. Try again in a moment.', { type: 'info' });
        setLoading(false);
        return;
      }
      const result = await promptAsync();
      if (result.type !== 'success') setLoading(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Google sign-in failed.', { type: 'error' });
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoHeader}>
          <View style={styles.badge}><Text style={styles.badgeText}>AI</Text></View>
          <Text style={styles.title}>ArchInvoice</Text>
          <Text style={styles.subtitle}>Sign in securely with your Google account</Text>
        </View>
        <Button
          title="Continue with Google"
          onPress={handleGoogleSignIn}
          loading={loading}
          disabled={!signInAvailable || (!isCloudflareWebAuth && !hasPlatformOAuthClient) || (Platform.OS !== 'web' && !request)}
          size="lg"
          style={styles.googleBtn}
        />
        {!signInAvailable && (
          <Text style={styles.configurationMessage}>
            Authentication is not configured. Set the Cloudflare API URL and auth provider, or configure Firebase in README.md.
          </Text>
        )}
        {signInAvailable && !isCloudflareWebAuth && !hasPlatformOAuthClient && (
          <Text style={styles.configurationMessage}>
            Add the Google OAuth client ID for this platform before signing in.
          </Text>
        )}
        <Text style={styles.notice}>
          New Google accounts continue to the company setup page. Team invitations require signing in with the invited email.
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
  googleBtn: { marginBottom: 12, backgroundColor: '#2563eb' },
  configurationMessage: { fontSize: 12, lineHeight: 18, color: '#b91c1c', textAlign: 'center', marginTop: 5 },
  notice: { color: '#64748b', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
