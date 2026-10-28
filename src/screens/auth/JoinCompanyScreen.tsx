import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../services/api';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../context/ToastContext';

function invitationFromValue(value: string): { tenantId: string; token: string } {
  try {
    const url = new URL(value);
    const token = url.searchParams.get('token');
    const tenantId = url.searchParams.get('tenantId');
    if (token && tenantId) return { tenantId, token };
  } catch {
    // The value may be the raw token.
  }
  return { tenantId: '', token: value.trim() };
}

export const JoinCompanyScreen: React.FC = () => {
  const { currentParams, navigateTo } = useTenant();
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const [inviteToken, setInviteToken] = useState(currentParams?.inviteToken || '');
  const [tenantId, setTenantId] = useState(currentParams?.tenantId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof currentParams?.inviteToken === 'string') setInviteToken(currentParams.inviteToken);
    if (typeof currentParams?.tenantId === 'string') setTenantId(currentParams.tenantId);
  }, [currentParams?.inviteToken, currentParams?.tenantId]);

  const handleJoin = async () => {
    const parsedInvite = invitationFromValue(inviteToken);
    const token = parsedInvite.token;
    const inviteTenantId = parsedInvite.tenantId || tenantId.trim();
    if (!user) {
      showToast('Sign in with the Google email this invitation was sent to.', { type: 'error' });
      navigateTo('signin', { inviteToken: token, tenantId: inviteTenantId });
      return;
    }
    if (!token || !inviteTenantId) {
      showToast('Open the secure invitation link or enter both its token and company ID.', { type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await api.joinTenant(inviteTenantId, token);
      await refreshUser();
      showToast('You joined the company team.', { type: 'success' });
      navigateTo('dashboard');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invitation could not be accepted.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Accept a team invitation</Text>
        <Text style={styles.subtitle}>
          Invitations are checked securely by the configured backend and can only be accepted using the invited Google email.
        </Text>
        {user ? (
          <Text style={styles.account}>Signed in as {user.email}</Text>
        ) : (
          <Button
            title="Sign in with Google first"
            onPress={() => navigateTo('signin', { inviteToken: inviteToken.trim(), tenantId: tenantId.trim() })}
            variant="outline"
            size="lg"
            style={styles.signInButton}
          />
        )}
        <Input
          label="Invitation link or token"
          value={inviteToken}
          onChangeText={setInviteToken}
          placeholder="Paste the invitation link"
          autoCapitalize="none"
          multiline
        />
        {!invitationFromValue(inviteToken).tenantId && (
          <Input
            label="Company ID"
            value={tenantId}
            onChangeText={setTenantId}
            placeholder="Company ID from the invitation"
            autoCapitalize="none"
          />
        )}
        <Button
          title="Accept invitation"
          onPress={() => void handleJoin()}
          loading={loading}
          disabled={!inviteToken.trim() || !tenantId.trim() && !invitationFromValue(inviteToken).tenantId}
          size="lg"
          style={styles.joinButton}
        />
        <TouchableOpacity style={styles.link} onPress={() => navigateTo(user ? 'create_company' : 'signin')}>
          <Text style={styles.linkText}>{user ? '‹ Back to company setup' : '‹ Back to sign in'}</Text>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity style={styles.link} onPress={() => void signOut()}>
            <Text style={styles.linkText}>Sign out of this account</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 18 },
  account: { color: '#1d4ed8', fontWeight: '700', fontSize: 12, marginBottom: 14 },
  signInButton: { marginBottom: 18 },
  joinButton: { marginTop: 4 },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { color: '#475569', fontWeight: '600', fontSize: 13 },
});
