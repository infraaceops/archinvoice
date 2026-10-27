import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { InvoiceDoc } from '../../types';
import { formatPKR } from '../../util/currency';
import { formatDate } from '../../util/dates';
import { useToast } from '../../context/ToastContext';

export const InvoicePreviewScreen: React.FC = () => {
  const { currentParams, issueInvoice, navigateTo, tenant, projects } = useTenant();
  const { role } = useAuth();
  const { showToast } = useToast();

  const invoice: InvoiceDoc = currentParams?.invoice;
  const [loading, setLoading] = useState(false);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Header title="Invoice Preview" showBack onBack={() => navigateTo('history')} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Invoice Not Found</Text>
          <Button title="Back to History" onPress={() => navigateTo('history')} />
        </View>
      </View>
    );
  }

  const project = projects.find((p) => p.id === invoice.projectId);

  const handleIssue = async () => {
    if (role === 'viewer') {
      showToast('Permission Denied: Viewer cannot issue invoices.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const issued = await issueInvoice(invoice.id);
      navigateTo('pdf_viewer', { invoice: issued });
    } catch (e: any) {
      showToast(e.message || 'Failed to issue invoice', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Invoice Preview: ${invoice.serial}`}
        subtitle={`Status: ${invoice.status.toUpperCase()} • Category: ${invoice.category.toUpperCase()}`}
        showBack
        onBack={() => navigateTo('history')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Document Card */}
        <Card style={styles.docCard}>
          {/* Header Row */}
          <View style={styles.docHeader}>
            <View>
              <Text style={styles.firmName}>{tenant.name}</Text>
              <Text style={styles.firmMeta}>{tenant.address}</Text>
              {tenant.ntn && <Text style={styles.firmMeta}>NTN: {tenant.ntn}</Text>}
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.serialNumber}>{invoice.serial}</Text>
              <Badge label={invoice.status} variant={invoice.status as any} style={{ marginVertical: 4 }} />
              <Text style={styles.dateText}>Created: {formatDate(invoice.createdAt)}</Text>
            </View>
          </View>

          {/* Billing Block */}
          <View style={styles.infoBlock}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockLabel}>BILL TO</Text>
              <Text style={styles.clientName}>{invoice.clientName}</Text>
              {project?.location && (
                <Text style={styles.blockSub}>{project.location}</Text>
              )}
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.blockLabel}>PROJECT</Text>
              <Text style={styles.projectName}>{project?.name || 'Architectural Commission'}</Text>
              <Text style={styles.blockSub}>
                {project?.type.toUpperCase()} • {project?.area} {project?.unit}
              </Text>
            </View>
          </View>

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 30 }]}>#</Text>
              <Text style={[styles.th, { flex: 2 }]}>Description</Text>
              <Text style={[styles.th, { width: 60, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Rate (PKR)</Text>
              <Text style={[styles.th, { width: 120, textAlign: 'right' }]}>Amount (PKR)</Text>
            </View>

            {invoice.lineItems.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, { width: 30 }]}>{idx + 1}</Text>
                <View style={{ flex: 2 }}>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                  <Text style={styles.itemCategory}>{item.category} ({item.pricingMode})</Text>
                </View>
                <Text style={[styles.td, { width: 60, textAlign: 'center' }]}>{item.qty}</Text>
                <Text style={[styles.td, { width: 100, textAlign: 'right' }]}>
                  {item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.tdBold, { width: 120, textAlign: 'right' }]}>
                  {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalsTable}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalVal}>{formatPKR(invoice.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({invoice.taxRate || 0}%)</Text>
                <Text style={styles.totalVal}>{formatPKR(invoice.tax)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalVal}>{formatPKR(invoice.total)}</Text>
              </View>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            {invoice.status === 'draft' ? (
              <Button
                title={role === 'viewer' ? 'Issue Restricted (Viewer Role)' : 'Issue & Generate Official PDF'}
                onPress={handleIssue}
                loading={loading}
                disabled={role === 'viewer'}
                size="lg"
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title="Open Official PDF Viewer"
                onPress={() => navigateTo('pdf_viewer', { invoice })}
                size="lg"
                style={{ flex: 1 }}
              />
            )}
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
  docCard: {
    padding: 28,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 16,
    marginBottom: 20,
  },
  firmName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  firmMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  serialNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  infoBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  blockSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  table: {
    width: '100%',
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  td: {
    fontSize: 13,
    color: '#475569',
  },
  tdBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemCategory: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 28,
  },
  totalsTable: {
    width: 280,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  totalVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#0f172a',
    marginTop: 8,
    paddingTop: 8,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionRow: {
    flexDirection: 'row',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
});
