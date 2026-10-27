import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StatCard } from '../../components/StatCard';
import { ProgressBar } from '../../components/ProgressBar';
import { formatPKR, formatCompactPKR } from '../../util/currency';
import { formatBytes } from '../../util/calculations';
import { formatDate } from '../../util/dates';
import pricing from '../../../config/pricing.json';

export const DashboardScreen: React.FC = () => {
  const { tenant, projects, invoices, members, navigateTo } = useTenant();

  // Compute metrics
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const issuedInvoices = invoices.filter((i) => i.status === 'issued' || i.status === 'paid');
  const totalBilledPkr = issuedInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const pendingInvoicesCount = invoices.filter((i) => i.status === 'draft').length;

  // Storage calculation
  const totalStorageQuotaBytes =
    ((tenant.storage?.includedGb || 1) + (tenant.storage?.purchasedGb || 0)) * 1024 * 1024 * 1024;
  const usedStorageBytes = tenant.storage?.usedBytes || 0;
  const storagePct = (usedStorageBytes / totalStorageQuotaBytes) * 100;

  // Egress calculation
  const hardCapBytes = (pricing.egress.hardCapGbPerMonth || 10) * 1024 * 1024 * 1024;
  const usedEgressBytes = tenant.storage?.egressMonthBytes || 0;
  const egressPct = (usedEgressBytes / hardCapBytes) * 100;

  const subStatus = tenant.subscription?.status || 'active';

  return (
    <View style={styles.container}>
      <Header
        title="Dashboard"
        subtitle={`${tenant.name} • FY ${tenant.settings?.invoiceDefaults?.financialYear || '2025'}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Subscription & Quota Warning Banner if Grace or Locked */}
        {subStatus !== 'active' && (
          <View
            style={[
              styles.alertBanner,
              { backgroundColor: subStatus === 'grace' ? '#fef3c7' : '#fee2e2' },
            ]}
          >
            <Text style={styles.alertIcon}>{subStatus === 'grace' ? '⚠️' : '🔒'}</Text>
            <View style={styles.alertTextWrap}>
              <Text
                style={[
                  styles.alertTitle,
                  { color: subStatus === 'grace' ? '#92400e' : '#991b1b' },
                ]}
              >
                {subStatus === 'grace'
                  ? 'Subscription Grace Period Active'
                  : 'Subscription Locked - Read-Only Mode'}
              </Text>
              <Text style={styles.alertDesc}>
                {subStatus === 'grace'
                  ? 'Your monthly core subscription requires renewal within 3 days.'
                  : 'Invoice creation is locked until subscription is renewed.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.alertActionBtn}
              onPress={() => navigateTo('billing')}
            >
              <Text style={styles.alertActionText}>Renew</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/* Quotas & Capacity Card */}
        <Card style={styles.quotasCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Cloud Resource Quotas & Meters</Text>
              <Text style={styles.cardSubtitle}>
                Monitored for cost-safety per single source of truth config/pricing.json
              </Text>
            </View>
            <Badge label={subStatus} variant={subStatus as any} />
          </View>

          <ProgressBar
            label="Storage Space"
            used={formatBytes(usedStorageBytes)}
            total={formatBytes(totalStorageQuotaBytes)}
            percentage={storagePct}
          />

          <ProgressBar
            label="Monthly Bandwidth / Egress"
            used={formatBytes(usedEgressBytes)}
            total={formatBytes(hardCapBytes)}
            percentage={egressPct}
          />

          <View style={styles.quotaActionsRow}>
            <TouchableOpacity
              style={styles.quotaActionBtn}
              onPress={() => navigateTo('billing')}
            >
              <Text style={styles.quotaActionText}>+ Buy 1 GB Storage Pack (PKR 100)</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#0f172a' }]}
            onPress={() => navigateTo('create_invoice')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionCardIcon}>⚡</Text>
            <Text style={styles.actionCardTitle}>Create Invoice</Text>
            <Text style={styles.actionCardDesc}>Allocate serial & calculate PKR</Text>
          </TouchableOpacity>

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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  alertIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  alertActionBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  alertActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  quotasCard: {
    marginBottom: 20,
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
  quotaActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  quotaActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  quotaActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
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
