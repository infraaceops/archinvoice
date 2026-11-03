import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StatCard } from '../../components/StatCard';
import { formatPKR, formatCompactPKR } from '../../util/currency';
import { formatDate } from '../../util/dates';

export const DashboardScreen: React.FC = () => {
  const { tenant, projects, invoices, members, navigateTo } = useTenant();

  // Compute metrics
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const issuedInvoices = invoices.filter((i) => i.status === 'issued' || i.status === 'paid');
  const totalBilledPkr = issuedInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const pendingInvoicesCount = invoices.filter((i) => i.status === 'draft').length;

  return (
    <View style={styles.container}>
      <Header
        title="Dashboard"
        subtitle={`${tenant.name} • FY ${tenant.settings?.invoiceDefaults?.financialYear || '2025'}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top KPI Stat Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Invoiced"
            value={formatCompactPKR(totalBilledPkr)}
            subtitle={`${issuedInvoices.length} invoices issued`}
            accentColor="#0f172a"
          />
          <StatCard
            title="Active Projects"
            value={activeProjectsCount}
            subtitle="Residential & Commercial"
            accentColor="#2563eb"
          />
          <StatCard
            title="Draft Invoices"
            value={pendingInvoicesCount}
            subtitle="Awaiting issue"
            accentColor="#f59e0b"
          />
          <StatCard
            title="Practice Members"
            value={members.length}
            subtitle="Admin & Architects"
            accentColor="#10b981"
          />
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#2563eb' }]}
            onPress={() => navigateTo('create_project')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionCardIcon}>📐</Text>
            <Text style={styles.actionCardTitle}>New Project</Text>
            <Text style={styles.actionCardDesc}>Set area & rate card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#059669' }]}
            onPress={() => navigateTo('history')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionCardIcon}>📜</Text>
            <Text style={styles.actionCardTitle}>Invoice Directory</Text>
            <Text style={styles.actionCardDesc}>Search, filter & export</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Invoices Table */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => navigateTo('history')}>
              <Text style={styles.viewAllText}>View All ({invoices.length}) ›</Text>
            </TouchableOpacity>
          </View>

          {invoices.slice(0, 5).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={styles.invoiceRow}
              onPress={() =>
                inv.status === 'draft'
                  ? navigateTo('invoice_preview', { invoice: inv })
                  : navigateTo('pdf_viewer', { invoice: inv })
              }
              activeOpacity={0.7}
            >
              <View style={styles.invLeft}>
                <Text style={styles.invSerial}>{inv.serial}</Text>
                <Text style={styles.invClient}>{inv.clientName}</Text>
                <Text style={styles.invDate}>{formatDate(inv.createdAt)}</Text>
              </View>

              <View style={styles.invRight}>
                <Text style={styles.invTotal}>{formatPKR(inv.total)}</Text>
                <Badge label={inv.status} variant={inv.status as any} style={styles.badgeMargin} />
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  actionCardIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionCardDesc: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
  },
  viewAllText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  invLeft: {
    flex: 1,
  },
  invSerial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  invClient: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  invDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  invRight: {
    alignItems: 'flex-end',
  },
  invTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgeMargin: {
    marginTop: 4,
  },
});
