import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../services/api';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../context/ToastContext';

export const CreateCompanyScreen: React.FC = () => {
  const { navigateTo, refreshData } = useTenant();
  const { showToast } = useToast();

  const [name, setName] = useState('Studio Axis Architecture & Interiors');
  const [ceoName, setCeoName] = useState('Ar. Shadab Khan');
  const [address, setAddress] = useState('Suite 402, Design Tower, Clifton, Karachi');
  const [ntn, setNtn] = useState('8392104-7');
  const [logoUrl, setLogoUrl] = useState('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=160&auto=format&fit=crop&q=80');
  const [sealUrl, setSealUrl] = useState('https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !ceoName.trim()) {
      showToast('Please enter both Company Name and CEO Name.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await api.createTenant({
        name,
        ceoName,
        address,
        ntn,
        logoBase64: logoUrl,
        sealBase64: sealUrl,
      });
      refreshData();
      showToast('Company registered successfully! 14-day trial active.', { type: 'success' });
      navigateTo('dashboard');
    } catch (e: any) {
      showToast(e.message || 'Failed to create company', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Register Architectural Practice</Text>
        <Text style={styles.subtitle}>
          Set up your firm details, branding mark, and digital seal for invoices.
        </Text>

        <Input
          label="Practice / Firm Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Studio Axis Architecture & Interiors"
        />

        <Input
          label="Chief Executive Officer (CEO) Name *"
          value={ceoName}
          onChangeText={setCeoName}
          placeholder="e.g. Ar. Shadab Khan"
        />

        <Input
          label="Office Address"
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. Suite 402, Design Tower, Clifton, Karachi"
        />

        <Input
          label="National Tax Number (NTN)"
          value={ntn}
          onChangeText={setNtn}
          placeholder="e.g. 8392104-7"
        />

        {/* Branding Previews */}
        <View style={styles.brandingSection}>
          <Text style={styles.sectionLabel}>Branding & Visual Seal</Text>
          <View style={styles.brandRow}>
            <View style={styles.brandBox}>
              <Text style={styles.brandBoxLabel}>Company Logo</Text>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.brandImg} />
              ) : (
                <Text style={styles.noImgText}>No Logo</Text>
              )}
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() =>
                  setLogoUrl(
                    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=160&auto=format&fit=crop&q=80'
                  )
                }
              >
                <Text style={styles.changeBtnText}>Default Logo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.brandBox}>
              <Text style={styles.brandBoxLabel}>Visual Seal Mark</Text>
              {sealUrl ? (
                <Image source={{ uri: sealUrl }} style={styles.brandImg} />
              ) : (
                <Text style={styles.noImgText}>No Seal</Text>
              )}
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() =>
                  setSealUrl(
                    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
                  )
                }
              >
                <Text style={styles.changeBtnText}>Default Seal</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.disclaimerText}>
            * Note: Seal is a visual watermark and company mark, not a certified digital signature.
          </Text>
        </View>

        <Button
          title="Create Company & Launch"
          onPress={handleSubmit}
          loading={loading}
          size="lg"
          style={styles.submitBtn}
        />

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => navigateTo('onboarding')}
        >
          <Text style={styles.backLinkText}>‹ Cancel & Go Back</Text>
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
    maxWidth: 540,
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
  brandingSection: {
    marginTop: 8,
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    gap: 16,
  },
  brandBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  brandBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  brandImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    objectFit: 'contain',
    marginBottom: 8,
  },
  noImgText: {
    fontSize: 12,
    color: '#94a3b8',
    height: 60,
    textAlignVertical: 'center',
  },
  changeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  changeBtnText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 10,
  },
  submitBtn: {
    marginTop: 8,
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
