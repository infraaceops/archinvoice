import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Category, LineItem, ProjectDoc } from '../../types';
import { calculateInvoiceTotals } from '../../util/calculations';
import { formatPKR } from '../../util/currency';
import { useToast } from '../../context/ToastContext';

export const CreateInvoiceScreen: React.FC = () => {
  const { projects, createInvoice, navigateTo, tenant, currentParams } = useTenant();
  const { role } = useAuth();
  const { showToast } = useToast();

  const preselectedProject: ProjectDoc | undefined = currentParams?.selectedProject;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    preselectedProject ? preselectedProject.id : projects[0]?.id || ''
  );
  const [category, setCategory] = useState<Category>('architecture');
  const [taxRate, setTaxRate] = useState<string>('0');
  const [clientName, setClientName] = useState<string>(
    preselectedProject ? preselectedProject.clientName : projects[0]?.clientName || ''
  );
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      desc: 'Architectural Working Drawings & Submission Dossier',
      category: 'architecture',
      qty: preselectedProject?.area || 2000,
      rate: preselectedProject?.rateCard?.architecture || 150,
      amount: (preselectedProject?.area || 2000) * (preselectedProject?.rateCard?.architecture || 150),
      pricingMode: 'per_sqft',
    },
  ]);
  const [loading, setLoading] = useState(false);

  // When project changes, update client name and default line item rate
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find((p) => p.id === projId);
    if (proj) {
      setClientName(proj.clientName);
      const rate = proj.rateCard?.[category] || 150;
      setLineItems([
        {
          desc: `${category.toUpperCase()} Professional Services for ${proj.name}`,
          category,
          qty: proj.area,
          rate,
          amount: proj.area * rate,
          pricingMode: 'per_sqft',
        },
      ]);
    }
  };

  // When category changes, update line items category
  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    const proj = projects.find((p) => p.id === selectedProjectId);
    const rate = proj?.rateCard?.[newCat] || 100;
    const qty = proj?.area || 1000;
    setLineItems([
      {
        desc: `${newCat.toUpperCase()} Consultancy & Deliverables`,
        category: newCat,
        qty,
        rate,
        amount: qty * rate,
        pricingMode: 'per_sqft',
      },
    ]);
  };

  const updateLineItem = (index: number, updates: Partial<LineItem>) => {
    const updated = [...lineItems];
    const curr = { ...updated[index], ...updates };
    curr.amount = Math.round((curr.qty || 0) * (curr.rate || 0) * 100) / 100;
    updated[index] = curr;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        desc: 'Additional Site Supervision & Inspection',
        category,
        qty: 1,
        rate: 25000,
        amount: 25000,
        pricingMode: 'manual',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) {
      showToast('At least one line item is required.', { type: 'warning' });
      return;
    }
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const totals = calculateInvoiceTotals(lineItems, parseFloat(taxRate) || 0);

  const handleCreateDraft = async () => {
    // Permission check per SPEC §4: Only admin or architect can write/issue invoices
    if (role === 'viewer') {
      showToast('Permission Denied: Viewer role cannot create invoices.', { type: 'error' });
      return;
    }

    // Subscription status check per SPEC §7.3
    if (tenant.subscription?.status === 'locked') {
      showToast('Tenant subscription is locked. Invoices cannot be created.', { type: 'error' });
      return;
    }

    if (!selectedProjectId) {
      showToast('Please select a project.', { type: 'error' });
      return;
    }

    if (!clientName.trim()) {
      showToast('Client name is required.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const invoice = await createInvoice({
        projectId: selectedProjectId,
        category,
        lineItems,
        taxRate: parseFloat(taxRate) || 0,
        clientName: clientName.trim(),
      });
      navigateTo('invoice_preview', { invoice });
    } catch (e: any) {
      showToast(e.message || 'Failed to create invoice', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fy = tenant.settings?.invoiceDefaults?.financialYear || '2025';
  const prefix = tenant.settings?.invoiceDefaults?.prefix?.[category] || 'ARCH';
  const nextSeq = tenant.settings?.invoiceDefaults?.startAt?.[category] || 1;

  return (
    <View style={styles.container}>
      <Header
        title="Create Invoice"
        subtitle={`Atomic serial counter sequence: ${prefix}-${fy}-${String(nextSeq).padStart(4, '0')}`}
        showBack
        onBack={() => navigateTo('dashboard')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Permission Banner for Viewer */}
        {role === 'viewer' && (
          <View style={styles.permissionWarning}>
            <Text style={styles.warningIcon}>🔒</Text>
            <Text style={styles.warningText}>
              You are currently viewing in <Text style={{ fontWeight: '700' }}>VIEWER</Text> role.
              Invoice creation requires Admin or Architect permissions. Click the role pill at the top right to switch roles.
            </Text>
          </View>
        )}

        <Card>
          <Text style={styles.sectionTitle}>1. Commission & Category</Text>

          {/* Category Tabs */}
          <View style={styles.categoryRow}>
            {(['architecture', 'interior', 'supervision'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                onPress={() => handleCategoryChange(cat)}
              >
                <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>
                  {cat.toUpperCase()} ({tenant.settings?.invoiceDefaults?.prefix?.[cat] || cat.slice(0, 3)})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Project Picker */}
          <Text style={styles.fieldLabel}>Select Commissioned Project</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projChips}>
            {projects.map((proj) => (
              <TouchableOpacity
                key={proj.id}
                style={[
                  styles.projChip,
                  selectedProjectId === proj.id && styles.projChipActive,
                ]}
                onPress={() => handleProjectSelect(proj.id)}
              >
                <Text
                  style={[
                    styles.projChipText,
                    selectedProjectId === proj.id && styles.projChipTextActive,
                  ]}
                >
                  {proj.name} ({proj.area} {proj.unit})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Input
            label="Bill To Client *"
            value={clientName}
            onChangeText={setClientName}
            placeholder="e.g. Malik Tariq"
          />
        </Card>

        {/* Line Items Editor */}
        <Card>
          <View style={styles.lineHeaderRow}>
            <Text style={styles.sectionTitle}>2. Line Items & Calculations</Text>
            <TouchableOpacity onPress={addLineItem} style={styles.addItemBtn}>
              <Text style={styles.addItemBtnText}>+ Add Line Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((item, idx) => (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemNumber}>Item #{idx + 1}</Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(idx)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Input
                label="Scope / Service Description"
                value={item.desc}
                onChangeText={(text) => updateLineItem(idx, { desc: text })}
                placeholder="Description of architectural services"
              />

              <View style={styles.itemCalcRow}>
                <Input
                  label="Quantity"
                  value={String(item.qty)}
                  onChangeText={(val) => updateLineItem(idx, { qty: parseFloat(val) || 0 })}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />

                <Input
                  label="Rate (PKR)"
                  value={String(item.rate)}
                  onChangeText={(val) => updateLineItem(idx, { rate: parseFloat(val) || 0 })}
                  keyboardType="numeric"
                  containerStyle={{ flex: 1 }}
                />

                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Amount</Text>
                  <Text style={styles.amountValue}>{formatPKR(item.amount)}</Text>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* Invoice Summary & Totals */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>3. Tax & Grand Total</Text>

          <View style={styles.taxInputRow}>
            <Input
              label="Tax Rate Percentage (%)"
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="0, 5, 13..."
              keyboardType="numeric"
              containerStyle={{ width: 160 }}
              suffix="%"
            />
            <Text style={styles.taxHelper}>
              e.g. 0% (standard), 5% (withholding), 13% (SRB), 16% (PRA)
            </Text>
          </View>

          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatPKR(totals.subtotal)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({taxRate}%)</Text>
              <Text style={styles.totalValue}>{formatPKR(totals.tax)}</Text>
            </View>

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatPKR(totals.total)}</Text>
            </View>
          </View>

          <Button
            title={role === 'viewer' ? 'Creation Restricted (Viewer Role)' : 'Allocate Serial & Create Draft'}
            onPress={handleCreateDraft}
            loading={loading}
            disabled={role === 'viewer'}
            size="lg"
            style={styles.createBtn}
          />
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
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#991b1b',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  catBtnActive: {
    backgroundColor: '#0f172a',
  },
  catBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  catBtnTextActive: {
    color: '#ffffff',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  projChips: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  projChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  projChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  projChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  projChipTextActive: {
    color: '#ffffff',
  },
  lineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  itemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  removeText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  itemCalcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountCol: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 8,
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryCard: {
    marginTop: 8,
  },
  taxInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  taxHelper: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
  },
  totalsTable: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    marginBottom: 20,
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
  totalValue: {
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
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  createBtn: {
    marginTop: 8,
  },
});
