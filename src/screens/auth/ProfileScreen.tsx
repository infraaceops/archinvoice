import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export const ProfileScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Header title="Profile" subtitle="Your ArchInvoice account" />
      <View style={styles.content}>
        <Card>
          <Text style={styles.name}>{user?.displayName || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.role}>Role: {user?.role?.toUpperCase()}</Text>
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
});
