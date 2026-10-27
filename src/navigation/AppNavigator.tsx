import React from 'react';
import { View, StyleSheet, useWindowDimensions, SafeAreaView } from 'react-native';
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
import { CreateInvoiceScreen } from '../screens/invoices/CreateInvoiceScreen';
import { InvoicePreviewScreen } from '../screens/invoices/InvoicePreviewScreen';
import { PdfViewerScreen } from '../screens/invoices/PdfViewerScreen';
import { InvoiceHistoryScreen } from '../screens/invoices/InvoiceHistoryScreen';
import { BillingScreen } from '../screens/billing/BillingScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';

export const AppNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { activeScreen } = useTenant();

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
      default:
        return <DashboardScreen />;
    }
  };

  const isAuthScreen =
    activeScreen === 'splash' ||
    activeScreen === 'signin' ||
    activeScreen === 'onboarding' ||
    activeScreen === 'create_company' ||
    activeScreen === 'join_company';

  if (isAuthScreen || !user) {
    return <SafeAreaView style={styles.safeContainer}>{renderScreen()}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.appShell}>
        {isDesktop && <Sidebar />}

        <View style={styles.contentArea}>
          {renderScreen()}
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
});
