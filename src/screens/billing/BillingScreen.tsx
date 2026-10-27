import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { formatPKR } from '../../util/currency';
import { formatBytes } from '../../util/calculations';
import { formatDate } from '../../util/dates';
import pricing from '../../../config/pricing.json';

export const BillingScreen: React.FC = () => {
  const { tenant, buyStoragePack, renewSubscription } = useTenant();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const sub = tenant.subscription;
  const storage = tenant.storage;

  const totalStorageQuotaBytes =
    ((storage?.includedGb || 1) + (storage?.purchasedGb || 0)) * 1024 * 1024 * 1024;
  const usedStorageBytes = storage?.usedBytes || 0;
  const storagePct = (usedStorageBytes / totalStorageQuotaBytes) * 100;

  const hardCapBytes = (pricing.egress.hardCapGbPerMonth || 10) * 1024 * 1024 * 1024;
  const usedEgressBytes = storage?.egressMonthBytes || 0;
  const egressPct = (usedEgressBytes / hardCapBytes) * 100;

  const handleBuyPack = async (packId: 'storage_pack_1gb' | 'storage_pack_5gb') => {
    setLoadingAction(packId);
    try {
      await buyStoragePack(packId);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRenew = async () => {
    setLoadingAction('renew');
    try {
      await renewSubscription();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Billing & Quotas"
        subtitle="SaaS Subscription, Storage Capacities & Google Play Billing"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Core Monthly Subscription Card */}
        <Card>
          <View style={styles.subHeader}>
            <View>
              <Text style={styles.planName}>Plan: Core Monthly</Text>
              <Text style={styles.planPrice}>PKR 280 / month</Text>
              <Text style={styles.periodText}>
                Period End: {formatDate(sub?.currentPeriodEnd)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Badge label={sub?.status || 'active'} variant={sub?.status as any} />
              <TouchableOpacity
                style={styles.renewBtn}
                onPress={handleRenew}
                disabled={loadingAction === 'renew'}
              >
                <Text style={styles.renewBtnText}>
                  {loadingAction === 'renew' ? 'Processing...' : 'Extend / Renew'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ Unlimited projects & multi-architect assignment</Text>
            <Text style={styles.featureItem}>✓ 1 GB Included High-Speed PDF Document Storage</Text>
            <Text style={styles.featureItem}>✓ 3 GB Included Bandwidth / Egress per month</Text>
            <Text style={styles.featureItem}>✓ Atomic serial counter guarantee ({tenant.settings?.invoiceDefaults?.financialYear})</Text>
          </View>
        </Card>

        {/* Storage Quota Card */}
        <Card>
          <Text style={styles.sectionTitle}>Storage Space & Document Quota</Text>
          <Text style={styles.sectionDesc}>
            Official issued invoice PDFs are stored securely in tenant-scoped cloud storage.
          </Text>

          <ProgressBar
            label="Storage Capacity"
            used={formatBytes(usedStorageBytes)}
            total={formatBytes(totalStorageQuotaBytes)}
            percentage={storagePct}
          />

          <View style={styles.packsGrid}>
            <View style={styles.packCard}>
              <Text style={styles.packTitle}>1 GB Storage Pack</Text>
              <Text style={styles.packPrice}>PKR 100</Text>
              <Text style={styles.packDesc}>+1 GB document capacity</Text>
              <Button
                title="+ Buy 1 GB"
                onPress={() => handleBuyPack('storage_pack_1gb')}
                loading={loadingAction === 'storage_pack_1gb'}
                size="sm"
                style={{ marginTop: 10 }}
              />
            </View>

            <View style={styles.packCard}>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>10% OFF</Text>
              </View>
              <Text style={styles.packTitle}>5 GB Storage Pack</Text>
              <Text style={styles.packPrice}>PKR 450</Text>
              <Text style={styles.packDesc}>+5 GB bulk capacity</Text>
              <Button
                title="+ Buy 5 GB"
                onPress={() => handleBuyPack('storage_pack_5gb')}
                loading={loadingAction === 'storage_pack_5gb'}
                size="sm"
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </Card>

        {/* Egress Bandwidth Card */}
        <Card>
          <Text style={styles.sectionTitle}>Monthly Egress & Download Bandwidth</Text>
          <Text style={styles.sectionDesc}>
            Hard cap set at {pricing.egress.hardCapGbPerMonth} GB/month to guarantee safety margin and prevent surprise overages.
          </Text>

          <ProgressBar
            label="Current Month Egress"
            used={formatBytes(usedEgressBytes)}
            total={formatBytes(hardCapBytes)}
            percentage={egressPct}
          />

          <View style={styles.policyNotice}>
            <Text style={styles.policyTitle}>Financial Protection Guardrails (config/pricing.json):</Text>
            <Text style={styles.policyText}>• Target Storage Safety Margin: {pricing.guardrails.minStorageMarginPct}%</Text>
            <Text style={styles.policyText}>• Target Egress Safety Margin: {pricing.guardrails.minEgressMarginPct}%</Text>
            <Text style={styles.policyText}>• Automated Throttle on negative margin: Enabled</Text>
          </View>
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
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 16,
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  periodText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  renewBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 6,
  },
  renewBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  featuresList: {
    gap: 6,
  },
  featureItem: {
    fontSize: 13,
    color: '#334155',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  packsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  packCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  packTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  packPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
  },
  packDesc: {
    fontSize: 11,
    color: '#64748b',
  },
  policyNotice: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  policyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  policyText: {
    fontSize: 12,
    color: '#334155',
    marginVertical: 1,
  },
});
