import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';

export const OnboardingScreen: React.FC = () => {
  const { navigateTo } = useTenant();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to ArchInvoice</Text>
        <Text style={styles.subtitle}>
          How would you like to set up your architectural practice?
        </Text>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={() => navigateTo('create_company')}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.choiceIcon}>🏛️</Text>
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Create New Firm</Text>
            <Text style={styles.choiceDesc}>
              Register your architectural & interior practice as Admin, customize company logo & seal, and invite architects.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={() => navigateTo('join_company')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.choiceIcon}>🔑</Text>
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Join Existing Firm</Text>
            <Text style={styles.choiceDesc}>
              Enter a 6-digit invite code provided by your firm's CEO or practice administrator to join as Architect or Viewer.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigateTo('signin')}
        >
          <Text style={styles.backLinkText}>‹ Back to Sign In</Text>
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
    maxWidth: 500,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  choiceIcon: {
    fontSize: 24,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  choiceDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  backLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
