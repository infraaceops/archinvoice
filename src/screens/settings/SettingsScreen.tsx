import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../context/ToastContext';
import { appConfig } from '../../config/app';
import { isFirebaseConfigured } from '../../config/firebase';

export const SettingsScreen: React.FC = () => {
  const {
    tenant,
    updateTenant,
    archiveTenant,
  } = useTenant();
  const { role } = useAuth();
  const { showToast } = useToast();
  const canArchiveCompany = isFirebaseConfigured && appConfig.authProvider !== 'cloudflare';

  const [name, setName] = useState(tenant.name);
  const [ceoName, setCeoName] = useState(tenant.ceoName);
  const [address, setAddress] = useState(tenant.address || '');
  const [ntn, setNtn] = useState(tenant.ntn || '');
  const [financialYear, setFinancialYear] = useState(
    tenant.settings?.invoiceDefaults?.financialYear || '2025'
  );
  const [archPrefix, setArchPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.architecture === 'ARCH'
      ? 'ABS'
      : tenant.settings?.invoiceDefaults?.prefix?.architecture || 'ABS'
  );
  const [interiorPrefix, setInteriorPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.interior || 'INT'
  );
  const [supervisionPrefix, setSupervisionPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.supervision || 'SUP'
  );

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState('');
  const [archiving, setArchiving] = useState(false);

  const handleSaveCompany = async () => {
    if (role !== 'admin') {
      showToast('Permission Denied: Only Admin can update company profile and settings.', {
        type: 'error',
      });
      return;
    }

    try {
      await updateTenant({
        name,
        ceoName,
        address,
        ntn,
        settings: {
          invoiceDefaults: {
            financialYear,
            prefix: {
              architecture: archPrefix,
              interior: interiorPrefix,
              supervision: supervisionPrefix,
            },
            startAt: tenant.settings?.invoiceDefaults?.startAt || {
              architecture: 1,
              interior: 1,
              supervision: 1,
            },
          },
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save company settings.', {
        type: 'error',
      });
    }
  };

  const handleArchiveCompany = async () => {
    if (archiveConfirmation !== tenant.name) return;
    setArchiving(true);
    try {
      await archiveTenant(archiveConfirmation);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not archive the company.', {
        type: 'error',
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Company & Billing Settings"
        subtitle="Business profile and invoice numbering"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Company Profile (Admin) */}
        <Card>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Firm Profile & Legal Signatory</Text>
            {role !== 'admin' && (
              <Badge label="Read Only (Admin Required)" variant="grace" />
            )}
          </View>

          <Input
            label="Practice / Firm Name"
            value={name}
            onChangeText={setName}
            editable={role === 'admin'}
          />

          <Input
            label="CEO / Principal Architect Name"
            value={ceoName}
            onChangeText={setCeoName}
            editable={role === 'admin'}
          />

          <View style={styles.row}>
            <Input
              label="Office Address"
              value={address}
              onChangeText={setAddress}
              containerStyle={styles.col}
              editable={role === 'admin'}
            />
            <Input
              label="NTN Number"
              value={ntn}
              onChangeText={setNtn}
              containerStyle={styles.col}
              editable={role === 'admin'}
            />
          </View>

          <Button
            title="Save Company Settings"
            onPress={handleSaveCompany}
            disabled={role !== 'admin'}
            size="md"
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        </Card>

        {/* Invoice Numbering Defaults */}
        <Card>
          <Text style={styles.cardTitle}>Invoice Numbering & Category Prefixes</Text>
          <Text style={styles.cardSubtitle}>
            Atomic sequence format: {'{PREFIX}'}-{'{FY}'}-{'{NNNN}'} (e.g. {archPrefix}-{financialYear}-0001)
          </Text>

          <View style={styles.row}>
            <Input
              label="Financial Year (FY)"
              value={financialYear}
              onChangeText={setFinancialYear}
              containerStyle={{ width: 140 }}
              editable={role === 'admin'}
            />
            <Input
              label="Architecture Prefix"
              value={archPrefix}
              onChangeText={setArchPrefix}
              containerStyle={styles.col}
              editable={role === 'admin'}
            />
            <Input
              label="Interior Prefix"
              value={interiorPrefix}
              onChangeText={setInteriorPrefix}
              containerStyle={styles.col}
              editable={role === 'admin'}
            />
            <Input
              label="Supervision Prefix"
              value={supervisionPrefix}
              onChangeText={setSupervisionPrefix}
              containerStyle={styles.col}
              editable={role === 'admin'}
            />
          </View>

          <Button
            title="Update Invoice Prefixes"
            onPress={handleSaveCompany}
            disabled={role !== 'admin'}
            variant="outline"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>

        {role === 'admin' && (
          <Card>
            <Text style={styles.cardTitle}>Archive Company</Text>
            <Text style={styles.archiveWarning}>
              Archiving blocks company access. Company,
              project, invoice, and generated PDF records are preserved. User accounts remain active
              and can set up a new company. Previously issued PDF links may remain usable
              until their 15-minute expiration. This archive cannot be reversed from the app.
            </Text>
            {!canArchiveCompany ? (
              <Text style={styles.cardSubtitle}>
                Company archiving requires the Firebase backend and is unavailable in Cloudflare-auth mode.
              </Text>
            ) : confirmArchive ? (
              <>
                <Input
                  label={`Type "${tenant.name}" to confirm`}
                  value={archiveConfirmation}
                  onChangeText={setArchiveConfirmation}
                  autoCapitalize="none"
                  editable={!archiving}
                />
                <View style={styles.rolePickerRow}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="sm"
                    disabled={archiving}
                    onPress={() => {
                      setConfirmArchive(false);
                      setArchiveConfirmation('');
                    }}
                  />
                  <Button
                    title="Archive company"
                    variant="danger"
                    size="sm"
                    loading={archiving}
                    disabled={archiveConfirmation !== tenant.name}
                    onPress={() => void handleArchiveCompany()}
                  />
                </View>
              </>
            ) : (
              <Button
                title="Archive Company"
                variant="danger"
                size="sm"
                onPress={() => setConfirmArchive(true)}
              />
            )}
          </Card>
        )}
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  col: {
    flex: 1,
    minWidth: 160,
  },
  rolePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  archiveWarning: { color: '#991b1b', fontSize: 13, lineHeight: 19, marginVertical: 10 },
});
