import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Badge } from '../../components/Badge';
import { Header } from '../../components/Header';
import { collaboration } from '../../services/collaboration';

export const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const { projects, navigateTo } = useTenant();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  if (!user) return null;

  const allNotifications = collaboration.getNotifications(user.email);
  const notifications = unreadOnly
    ? allNotifications.filter((item) => !item.read)
    : allNotifications;
  const refresh = () => setRefreshKey((value) => value + 1);
  void refreshKey;

  return (
    <View style={styles.container}>
      <Header title="Notifications" subtitle={`${allNotifications.filter((item) => !item.read).length} unread`} />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.filterButton, unreadOnly && styles.filterButtonActive]}
          onPress={() => setUnreadOnly((value) => !value)}
        >
          <Text style={[styles.filterText, unreadOnly && styles.filterTextActive]}>
            {unreadOnly ? 'Showing unread · tap to show all' : 'Show unread only'}
          </Text>
        </TouchableOpacity>
        {notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.notification, !item.read && styles.unread]}
            onPress={() => {
              const project = projects.find((record) => record.id === item.projectId);
              if (!item.read) {
                collaboration.markNotificationRead(item.id, user.email);
                refresh();
              }
              if (!project) return;
              if (item.drawingId) {
                navigateTo('collaboration', { project, drawingId: item.drawingId, revisionId: item.revisionId });
              } else {
                navigateTo('collaboration', { project });
              }
            }}
            activeOpacity={0.75}
          >
            <View style={styles.row}>
              <Text style={styles.icon}>
                {item.type === 'drawing_uploaded' ? '📐' : item.type === 'comment_added' ? '💬' : item.type === 'approved' ? '✅' : '✉️'}
              </Text>
              <View style={styles.details}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  {!item.read && <Badge label="NEW" variant="active" />}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.meta}>
                  {projects.find((project) => project.id === item.projectId)?.name || `Project ${item.projectId}`}
                  {' · '}
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.body}>New project drawing and review updates will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, width: '100%', maxWidth: 850, alignSelf: 'center' },
  filterButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  filterButtonActive: { backgroundColor: '#eff6ff', borderColor: '#60a5fa' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterTextActive: { color: '#1d4ed8' },
  notification: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 10 },
  unread: { borderColor: '#93c5fd', backgroundColor: '#f8fbff' },
  row: { flexDirection: 'row', gap: 12 },
  icon: { fontSize: 22 },
  details: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '800' },
  body: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 6 },
  meta: { color: '#94a3b8', fontSize: 11, marginTop: 8 },
  empty: { alignItems: 'center', padding: 36 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 5 },
});
