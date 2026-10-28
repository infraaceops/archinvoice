import React, { useEffect } from 'react';
import { ActivityIndicator, Linking, Text, View, StyleSheet, useWindowDimensions, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

import { Sidebar } from '../components/Sidebar';
import { TabBar } from '../components/TabBar';

// Screens
import { SplashScreen } from '../screens/auth/SplashScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { CreateCompanyScreen } from '../screens/auth/CreateCompanyScreen';
import { JoinCompanyScreen } from '../screens/auth/JoinCompanyScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ProjectListScreen } from '../screens/projects/ProjectListScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { CollaborationScreen } from '../screens/projects/CollaborationScreen';
import { NotificationsScreen } from '../screens/projects/NotificationsScreen';
import { CreateInvoiceScreen } from '../screens/invoices/CreateInvoiceScreen';
import { InvoicePreviewScreen } from '../screens/invoices/InvoicePreviewScreen';
import { PdfViewerScreen } from '../screens/invoices/PdfViewerScreen';
import { InvoiceHistoryScreen } from '../screens/invoices/InvoiceHistoryScreen';
import { BillingScreen } from '../screens/billing/BillingScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/auth/ProfileScreen';

export const AppNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const { user, role, loading } = useAuth();
  const { activeScreen, navigateTo } = useTenant();
  const clientScreens = ['projects', 'project_detail', 'collaboration', 'notifications', 'profile'];
  const clientScreenBlocked = role === 'client' && !clientScreens.includes(activeScreen);
  const isAuthScreen =
    activeScreen === 'splash' ||
    activeScreen === 'signin' ||
    activeScreen === 'onboarding' ||
    activeScreen === 'create_company' ||
    activeScreen === 'join_company';

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthScreen) navigateTo('signin');
    else if (user?.role === 'client' && clientScreenBlocked) navigateTo('projects');
    else if (user && !user.tenantId && activeScreen !== 'create_company' && activeScreen !== 'join_company') {
      navigateTo('create_company');
    } else if (user?.tenantId && isAuthScreen) navigateTo('dashboard');
  }, [activeScreen, clientScreenBlocked, isAuthScreen, loading, navigateTo, user]);

  useEffect(() => {
    const handleInviteUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const inviteToken = parsed.searchParams.get('token');
        const tenantId = parsed.searchParams.get('tenantId');
        const isInvite =
          parsed.hostname === 'join' ||
          parsed.pathname === '/join' ||
          (parsed.searchParams.has('token') && parsed.searchParams.has('tenantId')) ||
          parsed.searchParams.has('invite');
        if (!isInvite) return;
        const token = inviteToken || parsed.searchParams.get('invite');
        if (!token || !tenantId) return;
        navigateTo(user ? 'join_company' : 'signin', { inviteToken: token, tenantId });
      } catch (error) {
        console.error('Could not parse invitation link.', error);
      }
    };
    void Linking.getInitialURL().then(handleInviteUrl).catch((error: unknown) => {
      console.error('Could not read the initial app link.', error);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleInviteUrl(url));
    return () => subscription.remove();
  }, [navigateTo, user]);

  const isDesktop = width >= 768;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'signin':
        return <SignInScreen />;
      case 'onboarding':
        return <OnboardingScreen />;
      case 'create_company':
        return <CreateCompanyScreen />;
      case 'join_company':
        return <JoinCompanyScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'projects':
        return <ProjectListScreen />;
      case 'create_project':
        return <CreateProjectScreen />;
      case 'project_detail':
        return <ProjectDetailScreen />;
      case 'collaboration':
        return <CollaborationScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'create_invoice':
        return <CreateInvoiceScreen />;
      case 'invoice_preview':
        return <InvoicePreviewScreen />;
      case 'pdf_viewer':
        return <PdfViewerScreen />;
      case 'history':
        return <InvoiceHistoryScreen />;
      case 'billing':
        return <BillingScreen />;
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
          {clientScreenBlocked ? <ProjectListScreen /> : renderScreen()}
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
