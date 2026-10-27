import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../services/api';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../context/ToastContext';

export const JoinCompanyScreen: React.FC = () => {
  const { navigateTo, refreshData } = useTenant();
  const { showToast } = useToast();

  const [inviteCode, setInviteCode] = useState('ARC-7492');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      showToast('Please enter an invite code.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.joinTenant(inviteCode);
      refreshData();
      showToast(`Joined firm successfully as ${res.role.toUpperCase()}!`, { type: 'success' });
      navigateTo('dashboard');
    } catch (e: any) {
      showToast(e.message || 'Invalid or expired invite code', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Join Architectural Firm</Text>
        <Text style={styles.subtitle}>
          Enter the invite code issued by your firm administrator.
        </Text>

        <Input
          label="6-Digit Invite Code"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="e.g. ARC-7492"
          autoCapitalize="characters"
          style={styles.codeInput}
        />

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Demo Codes to Test:</Text>
          <Text style={styles.hintItem}>• <Text style={styles.bold}>ARC-7492</Text> - Join as Architect</Text>
          <Text style={styles.hintItem}>• <Text style={styles.bold}>ADM-9182</Text> - Join as Admin</Text>
        </View>

        <Button
          title="Verify & Join Firm"
          onPress={handleJoin}
          loading={loading}
          size="lg"
          style={styles.joinBtn}
        />

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigateTo('onboarding')}
        >
          <Text style={styles.backLinkText}>‹ Cancel & Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
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
    marginBottom: 20,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  hintBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  hintTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintItem: {
    fontSize: 12,
    color: '#334155',
    marginVertical: 2,
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  joinBtn: {
    marginTop: 4,
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
