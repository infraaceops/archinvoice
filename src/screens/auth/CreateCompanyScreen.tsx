import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../context/ToastContext';
import { appConfig } from '../../config/app';

function companyCreationErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'functions/internal'
  ) {
    return 'Company creation is failing because the app is still pointing at a broken Firebase configuration or the createTenant logic is not deployed. Check EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN and Google OAuth redirect settings, then confirm Firestore is enabled in your Firebase project.';
  }
  return error instanceof Error ? error.message : 'Failed to create company.';
}

export const CreateCompanyScreen: React.FC = () => {
  const { navigateTo, refreshData } = useTenant();
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [ceoName, setCeoName] = useState(user?.displayName || '');
  const [address, setAddress] = useState('');
  const [ntn, setNtn] = useState('');
  const [logo, setLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [seal, setSeal] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const selectImage = async (target: 'logo' | 'seal') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Allow photo library access to select your company image.', { type: 'error' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected?.width || !selected.height) {
        showToast('The selected image could not be read. Choose another image.', { type: 'error' });
        return;
      }
      const scale = Math.min(1, 512 / selected.width, 512 / selected.height);
      const width = Math.max(1, Math.round(selected.width * scale));
      const height = Math.max(1, Math.round(selected.height * scale));
      const compressed = await ImageManipulator.manipulateAsync(
        selected.uri,
        [{ resize: { width, height } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const maxBase64Length = appConfig.authProvider === 'cloudflare' ? 66_668 : 174_900;
      if (!compressed.base64 || compressed.base64.length > maxBase64Length) {
        showToast(
          appConfig.authProvider === 'cloudflare'
            ? 'Choose a smaller image (maximum 50 KB) for the Cloudflare D1 profile.'
            : 'This image is too large for inline company branding. Choose a smaller image.',
          { type: 'error' },
        );
        return;
      }
      const brandingImage = {
        ...selected,
        uri: compressed.uri,
        base64: compressed.base64,
        mimeType: 'image/jpeg',
        fileSize: Math.ceil(compressed.base64.length * 0.75),
      };
      if (target === 'logo') setLogo(brandingImage);
      else setSeal(brandingImage);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not select the company image.', { type: 'error' });
    }
  };

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
        logoBase64: logo?.base64 ?? undefined,
        logoMimeType: logo?.mimeType ?? undefined,
        sealBase64: seal?.base64 ?? undefined,
        sealMimeType: seal?.mimeType ?? undefined,
      });
      await refreshUser();
      refreshData();
      showToast(
        appConfig.authProvider === 'cloudflare'
          ? 'Company registered successfully.'
          : 'Company registered successfully! 14-day trial active.',
        { type: 'success' },
      );
      navigateTo('dashboard');
    } catch (error) {
      showToast(companyCreationErrorMessage(error), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Register Architectural Practice</Text>
        <Text style={styles.subtitle}>
          Signed in as {user?.email}. Add your company details and optional compact logo and seal.
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
              {logo ? (
                <Image source={{ uri: logo.uri }} style={styles.brandImg} />
              ) : (
                <Text style={styles.noImgText}>No logo selected</Text>
              )}
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => void selectImage('logo')}
              >
                <Text style={styles.changeBtnText}>{logo ? 'Change logo' : 'Choose logo'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.brandBox}>
              <Text style={styles.brandBoxLabel}>Visual Seal Mark</Text>
              {seal ? (
                <Image source={{ uri: seal.uri }} style={styles.brandImg} />
              ) : (
                <Text style={styles.noImgText}>No photo selected</Text>
              )}
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => void selectImage('seal')}
              >
                <Text style={styles.changeBtnText}>{seal ? 'Change photo' : 'Choose company photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.disclaimerText}>
            Images are compressed and saved with your company profile (up to 50 KB each on Cloudflare, or 128 KB with Firebase; no Storage bucket needed). The seal is a visual mark, not a certified digital signature.
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
          onPress={() => navigateTo('join_company')}
        >
          <Text style={styles.backLinkText}>Have a team invitation? Accept it here</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => void signOut()}
        >
          <Text style={styles.backLinkText}>Sign out</Text>
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
