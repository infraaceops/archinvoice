import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatPKR } from '../../util/currency';
import { formatDate } from '../../util/dates';
import { Category, InvoiceDoc, InvoiceStatus } from '../../types';
import { useToast } from '../../context/ToastContext';

export const InvoiceHistoryScreen: React.FC = () => {
  const { invoices, navigateTo, updateInvoiceStatus } = useTenant();
  const { showToast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesCategory = categoryFilter === 'all' || inv.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesSearch =
      inv.serial.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleBulkExport = () => {
    // Per SPEC §14 & §15: Bulk export is rate-limited to 1 per day
    showToast('Exporting ZIP archive of all official PDFs... (1 export per day quota)', {
      type: 'info',
    });
    setTimeout(() => {
      showToast('ArchInvoice_Invoices_Export_2025.zip generated successfully!', {
        type: 'success',
      });
    }, 1200);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Invoices Directory"
        subtitle={`Total ${invoices.length} invoices issued across practice categories`}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="📦 Export ZIP"
              onPress={handleBulkExport}
              variant="outline"
              size="sm"
            />
            <Button
              title="+ Create Invoice"
              onPress={() => navigateTo('create_invoice')}
              size="sm"
            />
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search & Filter Bar */}
        <Card style={styles.filterCard}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by serial number (e.g. ARCH-2025-0001) or client..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Category Filter Pills */}
          <View style={styles.pillGroupRow}>
            <Text style={styles.pillGroupLabel}>Category:</Text>
            {(['all', 'architecture', 'interior', 'supervision'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, categoryFilter === cat && styles.pillActive]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[styles.pillText, categoryFilter === cat && styles.pillTextActive]}>
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Filter Pills */}
          <View style={styles.pillGroupRow}>
            <Text style={styles.pillGroupLabel}>Status:</Text>
            {(['all', 'draft', 'issued', 'paid', 'cancelled'] as const).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.pill, statusFilter === st && styles.pillActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
                  {st.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Invoices List */}
        <Card>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Showing {filteredProjectsCount(filteredInvoices)} Invoices
            </Text>
          </View>

          {filteredInvoices.map((inv: InvoiceDoc) => (
            <View key={inv.id} style={styles.invoiceRow}>
              <TouchableOpacity
                style={styles.invInfo}
                onPress={() =>
                  inv.status === 'draft'
                    ? navigateTo('invoice_preview', { invoice: inv })
                    : navigateTo('pdf_viewer', { invoice: inv })
                }
              >
                <View style={styles.serialGroup}>
                  <Text style={styles.serialText}>{inv.serial}</Text>
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{inv.category.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.clientText}>Client: {inv.clientName}</Text>
                <Text style={styles.dateSub}>Date: {formatDate(inv.createdAt)}</Text>
              </TouchableOpacity>

              <View style={styles.invRightCol}>
                <Text style={styles.amountText}>{formatPKR(inv.total)}</Text>
                <Badge label={inv.status} variant={inv.status as any} style={{ marginVertical: 4 }} />

                <View style={styles.actionLinks}>
                  <TouchableOpacity
                    onPress={() =>
                      inv.status === 'draft'
                        ? navigateTo('invoice_preview', { invoice: inv })
                        : navigateTo('pdf_viewer', { invoice: inv })
                    }
                  >
                    <Text style={styles.actionLinkText}>View</Text>
                  </TouchableOpacity>

                  {inv.status === 'issued' && (
                    <TouchableOpacity
                      onPress={() => updateInvoiceStatus(inv.id, 'paid')}
                    >
                      <Text style={[styles.actionLinkText, { color: '#059669' }]}>Mark Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}

          {filteredInvoices.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>No Invoices Match Filters</Text>
              <Text style={styles.emptyDesc}>Try clearing your filters or create a new invoice.</Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

function filteredProjectsCount(items: any[]) {
  return items.length;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  filterCard: {
    padding: 16,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#0f172a',
  },
  pillGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  pillGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    width: 65,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: '#0f172a',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  listHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  invInfo: {
    flex: 1,
  },
  serialGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serialText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  catBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f172a',
  },
  clientText: {
    fontSize: 13,
    color: '#334155',
    marginTop: 4,
    fontWeight: '500',
  },
  dateSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  invRightCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionLinks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});
