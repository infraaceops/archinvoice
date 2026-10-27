import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { InvoiceDoc } from '../../types';
import { formatPKR } from '../../util/currency';
import { formatDate } from '../../util/dates';
import { generateAndSharePdf } from '../../services/pdfGenerator';
import { useToast } from '../../context/ToastContext';

export const PdfViewerScreen: React.FC = () => {
  const { currentParams, navigateTo, tenant, projects } = useTenant();
  const { showToast } = useToast();

  const invoice: InvoiceDoc = currentParams?.invoice;
  const [sharing, setSharing] = useState(false);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Header title="PDF Viewer" showBack onBack={() => navigateTo('history')} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Invoice Not Found</Text>
          <Button title="Back to Invoices" onPress={() => navigateTo('history')} />
        </View>
      </View>
    );
  }

  const project = projects.find((p) => p.id === invoice.projectId);

  const handleShareOrPrint = async () => {
    setSharing(true);
    try {
      await generateAndSharePdf(invoice, tenant, project);
      showToast(Platform.OS === 'web' ? 'Opened print preview' : 'Shared PDF successfully!', {
        type: 'success',
      });
    } catch (e: any) {
      showToast(e.message || 'Error generating PDF', { type: 'error' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Official Invoice: ${invoice.serial}`}
        subtitle="PDF View & Export • Watermarked with Company Seal"
        showBack
        onBack={() => navigateTo('history')}
        rightAction={
          <Button
            title={Platform.OS === 'web' ? '🖨️ Print / Download' : '📤 Share PDF'}
            onPress={handleShareOrPrint}
            loading={sharing}
            size="sm"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Actions Bar */}
        <View style={styles.topActionBar}>
          <TouchableOpacity style={styles.topBtn} onPress={handleShareOrPrint}>
            <Text style={styles.topBtnText}>📥 Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={handleShareOrPrint}>
            <Text style={styles.topBtnText}>🖨️ Print A4</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={handleShareOrPrint}>
            <Text style={styles.topBtnText}>🔗 Share Document</Text>
          </TouchableOpacity>
        </View>

        {/* High-Fidelity A4 Sheet Replica */}
        <Card style={styles.a4Sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.brandGroup}>
              {tenant.logoUrl && (
                <Image source={{ uri: tenant.logoUrl }} style={styles.logo} />
              )}
              <View>
                <Text style={styles.companyName}>{tenant.name}</Text>
                {tenant.address && (
                  <Text style={styles.companySub}>{tenant.address}</Text>
                )}
                {tenant.ntn && (
                  <Text style={styles.companySub}>NTN: {tenant.ntn}</Text>
                )}
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.serial}>{invoice.serial}</Text>
              <Text style={styles.metaLine}>
                Date: {formatDate(invoice.issuedAt || invoice.createdAt)}
              </Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{invoice.category.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Client & Project Info */}
          <View style={styles.clientBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>BILL TO:</Text>
              <Text style={styles.infoStrong}>{invoice.clientName}</Text>
              {project?.location && (
                <Text style={styles.infoSub}>{project.location}</Text>
              )}
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>PROJECT:</Text>
              <Text style={styles.infoStrong}>{project?.name || 'Architectural Work'}</Text>
              <Text style={styles.infoSub}>
                {project?.type.toUpperCase()} • {project?.area} {project?.unit}
              </Text>
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, { width: 30 }]}>#</Text>
              <Text style={[styles.th, { flex: 2 }]}>Description</Text>
              <Text style={[styles.th, { width: 60, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Rate (PKR)</Text>
              <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Amount (PKR)</Text>
            </View>

            {invoice.lineItems.map((item, idx) => (
              <View key={idx} style={styles.trow}>
                <Text style={[styles.td, { width: 30 }]}>{idx + 1}</Text>
                <View style={{ flex: 2 }}>
                  <Text style={styles.tdDesc}>{item.desc}</Text>
                  {item.pricingMode === 'per_sqft' && (
                    <Text style={styles.tdPricingMode}>Rate card calculated based on covered area</Text>
                  )}
                </View>
                <Text style={[styles.td, { width: 60, textAlign: 'center' }]}>{item.qty}</Text>
                <Text style={[styles.td, { width: 100, textAlign: 'right' }]}>
                  {item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.tdBold, { width: 110, textAlign: 'right' }]}>
                  {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsWrap}>
            <View style={styles.totalsBox}>
              <View style={styles.totalLine}>
                <Text style={styles.totalText}>Subtotal</Text>
                <Text style={styles.totalNum}>{formatPKR(invoice.subtotal)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalText}>Tax ({invoice.taxRate || 0}%)</Text>
                <Text style={styles.totalNum}>{formatPKR(invoice.tax)}</Text>
              </View>
              <View style={[styles.totalLine, styles.grandLine]}>
                <Text style={styles.grandText}>Total</Text>
                <Text style={styles.grandNum}>{formatPKR(invoice.total)}</Text>
              </View>
            </View>
          </View>

          {/* Footer with Seal Watermark & CEO Signature */}
          <View style={styles.sheetFooter}>
            <View style={styles.sealContainer}>
              {tenant.sealUrl && (
                <Image source={{ uri: tenant.sealUrl }} style={styles.sealImg} />
              )}
              <Text style={styles.sealDisclaimer}>
                * This seal is a company visual mark, not a certified digital signature.
              </Text>
            </View>

            <View style={styles.signatoryContainer}>
              <View style={styles.signLine} />
              <Text style={styles.ceoName}>{tenant.ceoName}</Text>
              <Text style={styles.ceoTitle}>Chief Executive Officer</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    padding: 20,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  topBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  topBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  a4Sheet: {
    backgroundColor: '#ffffff',
    padding: 36,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#0f172a',
    paddingBottom: 20,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  companySub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  serial: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  metaLine: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  clientBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginVertical: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 2,
  },
  infoStrong: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  infoSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  table: {
    width: '100%',
    marginBottom: 24,
  },
  thead: {
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
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  td: {
    fontSize: 12,
    color: '#334155',
  },
  tdBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  tdDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  tdPricingMode: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  totalsWrap: {
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  totalsBox: {
    width: 280,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalText: {
    fontSize: 13,
    color: '#64748b',
  },
  totalNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  grandLine: {
    borderTopWidth: 2,
    borderTopColor: '#0f172a',
    marginTop: 8,
    paddingTop: 8,
  },
  grandText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  grandNum: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 24,
  },
  sealContainer: {
    alignItems: 'center',
    maxWidth: 220,
  },
  sealImg: {
    width: 75,
    height: 75,
    objectFit: 'contain',
    opacity: 0.9,
    marginBottom: 6,
  },
  sealDisclaimer: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 11,
  },
  signatoryContainer: {
    alignItems: 'center',
    width: 200,
  },
  signLine: {
    width: 180,
    height: 1.5,
    backgroundColor: '#0f172a',
    marginBottom: 6,
  },
  ceoName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  ceoTitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
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
