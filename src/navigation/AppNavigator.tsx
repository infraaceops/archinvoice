import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View, StyleSheet, useWindowDimensions, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

import { Sidebar } from '../components/Sidebar';
import { TabBar } from '../components/TabBar';

// Screens
import { SplashScreen } from '../screens/auth/SplashScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ProjectListScreen } from '../screens/projects/ProjectListScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { CreateInvoiceScreen } from '../screens/invoices/CreateInvoiceScreen';
import { InvoicePreviewScreen } from '../screens/invoices/InvoicePreviewScreen';
import { PdfViewerScreen } from '../screens/invoices/PdfViewerScreen';
import { InvoiceHistoryScreen } from '../screens/invoices/InvoiceHistoryScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/auth/ProfileScreen';

export const AppNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const { user, role, loading } = useAuth();
  const { activeScreen, navigateTo } = useTenant();
  const clientScreens = ['profile'];
  const clientScreenBlocked = role === 'client' && !clientScreens.includes(activeScreen);
  const isAuthScreen =
    activeScreen === 'splash' ||
    activeScreen === 'signin';

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthScreen) navigateTo('signin');
    else if (user?.role === 'client' && clientScreenBlocked) navigateTo('profile');
    else if (user && !user.tenantId && !['dashboard', 'settings', 'profile'].includes(activeScreen)) {
      navigateTo('settings');
    } else if (user?.tenantId && isAuthScreen) navigateTo('dashboard');
  }, [activeScreen, clientScreenBlocked, isAuthScreen, loading, navigateTo, user]);

  const isDesktop = width >= 768;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'signin':
        return <SignInScreen />;
      case 'create_company':
        return <SettingsScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'projects':
        return <ProjectListScreen />;
      case 'create_project':
        return <CreateProjectScreen />;
      case 'project_detail':
        return <ProjectDetailScreen />;
      case 'create_invoice':
        return <CreateInvoiceScreen />;
      case 'invoice_preview':
        return <InvoicePreviewScreen />;
      case 'pdf_viewer':
        return <PdfViewerScreen />;
      case 'history':
        return <InvoiceHistoryScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.loading}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.loadingText}>Checking your secure session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthScreen || !user) {
    return <SafeAreaView style={styles.safeContainer}>{renderScreen()}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.appShell}>
        {isDesktop && <Sidebar />}

        <View style={styles.contentArea}>
          {clientScreenBlocked ? <ProfileScreen /> : renderScreen()}
          {!isDesktop && <TabBar />}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  appShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#cbd5e1', marginTop: 12, fontSize: 13 },
});
