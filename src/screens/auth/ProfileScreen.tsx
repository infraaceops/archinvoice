import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useToast } from '../../context/ToastContext';

export const ProfileScreen: React.FC = () => {
  const { user, signOut, changeCredentials } = useAuth();
  const { showToast } = useToast();
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangeCredentials = async () => {
    setSaving(true);
    try {
      await changeCredentials(currentUsername, currentPassword, newUsername, newPassword);
      setCurrentUsername('');
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      showToast('Username and password updated.', { type: 'success' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update account credentials.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Profile" subtitle="Your ABS Invoice account" />
      <View style={styles.content}>
        <Card>
          <Text style={styles.name}>{user?.username || user?.displayName || 'User'}</Text>
          <Text style={styles.email}>Username: {user?.username || user?.email}</Text>
          <Text style={styles.role}>Role: {user?.role?.toUpperCase()}</Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>Change username and password</Text>
          <Text style={styles.helpText}>Your current username and password are required to authorize this change.</Text>
          <Input
            label="Previous username"
            value={currentUsername}
            onChangeText={setCurrentUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />
          <Input
            label="Previous password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            editable={!saving}
          />
          <Input
            label="New username"
            value={newUsername}
            onChangeText={setNewUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />
          <Input
            label="New password (at least 12 characters)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            editable={!saving}
          />
          <Button
            title="Update credentials"
            onPress={() => void handleChangeCredentials()}
            loading={saving}
            disabled={!currentUsername || !currentPassword || !newUsername || !newPassword}
          />
        </Card>
        <Button title="Sign out" onPress={signOut} variant="outline" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, width: '100%', maxWidth: 650, alignSelf: 'center' },
  name: { color: '#0f172a', fontSize: 20, fontWeight: '800' },
  email: { color: '#64748b', fontSize: 14, marginTop: 6 },
  role: { color: '#475569', fontSize: 12, fontWeight: '700', marginTop: 14 },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  helpText: { color: '#64748b', fontSize: 13, lineHeight: 18, marginBottom: 16 },
});
