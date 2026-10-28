import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTenant, ScreenName } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';

export const TabBar: React.FC = () => {
  const { activeScreen, navigateTo } = useTenant();
  const { role } = useAuth();

  const clientTabs: Array<{ screen: ScreenName; label: string; icon: string }> = [
    { screen: 'projects', label: 'Projects', icon: '📐' },
    { screen: 'notifications', label: 'Updates', icon: '🔔' },
    { screen: 'profile', label: 'Profile', icon: '👤' },
  ];
  const firmTabs: Array<{ screen: ScreenName; label: string; icon: string }> = [
    { screen: 'dashboard', label: 'Home', icon: '📊' },
    { screen: 'projects', label: 'Projects', icon: '📐' },
    { screen: 'notifications', label: 'Updates', icon: '🔔' },
    { screen: 'create_invoice', label: 'New Invoice', icon: '⚡' },
    { screen: 'history', label: 'Invoices', icon: '📜' },
    { screen: 'billing', label: 'Billing', icon: '💳' },
    { screen: 'settings', label: 'Settings', icon: '⚙️' },
  ];
  const tabs = role === 'client' ? clientTabs : firmTabs;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive =
          activeScreen === tab.screen ||
          (tab.screen === 'projects' && (activeScreen === 'create_project' || activeScreen === 'project_detail')) ||
          (tab.screen === 'create_invoice' && (activeScreen === 'invoice_preview' || activeScreen === 'pdf_viewer'));

        return (
          <TouchableOpacity
            key={tab.screen}
            style={styles.tab}
            onPress={() => navigateTo(tab.screen)}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.7,
  },
  iconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
  labelActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
