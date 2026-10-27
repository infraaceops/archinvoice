import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTenant, ScreenName } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { activeScreen, navigateTo, tenant } = useTenant();
  const { signOut, user } = useAuth();

  const navItems: Array<{ screen: ScreenName; label: string; icon: string }> = [
    { screen: 'dashboard', label: 'Dashboard', icon: '📊' },
    { screen: 'projects', label: 'Projects', icon: '📐' },
    { screen: 'create_invoice', label: 'Create Invoice', icon: '⚡' },
    { screen: 'history', label: 'Invoices History', icon: '📜' },
    { screen: 'billing', label: 'Billing & Quotas', icon: '💳' },
    { screen: 'settings', label: 'Company Settings', icon: '⚙️' },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Brand & Firm Name */}
      <View style={styles.brandContainer}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>AI</Text>
        </View>
        <View style={styles.brandTextContainer}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {tenant?.name || 'ArchInvoice'}
          </Text>
          <Text style={styles.brandSubtitle}>SaaS Architecture App</Text>
        </View>
      </View>

      {/* Navigation Items */}
      <View style={styles.navContainer}>
        {navItems.map((item) => {
          const isActive =
            activeScreen === item.screen ||
            (item.screen === 'projects' && (activeScreen === 'create_project' || activeScreen === 'project_detail')) ||
            (item.screen === 'create_invoice' && (activeScreen === 'invoice_preview' || activeScreen === 'pdf_viewer'));

          return (
            <TouchableOpacity
              key={item.screen}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigateTo(item.screen)}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User profile & Logout */}
      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName ? user.displayName[0] : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.displayName || 'User'}
            </Text>
            <Text style={styles.userRole}>
              Role: {user?.role?.toUpperCase() || 'VIEWER'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={signOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#0f172a', // Slate-900
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoMarkText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  navContainer: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#1e293b',
  },
  navIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  navLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 16,
    marginTop: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  userRole: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  signOutButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  signOutText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
});
