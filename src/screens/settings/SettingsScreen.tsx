import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Role } from '../../types';
import { useToast } from '../../context/ToastContext';

export const SettingsScreen: React.FC = () => {
  const { tenant, updateTenant, members, generateInvite } = useTenant();
  const { role } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(tenant.name);
  const [ceoName, setCeoName] = useState(tenant.ceoName);
  const [address, setAddress] = useState(tenant.address || '');
  const [ntn, setNtn] = useState(tenant.ntn || '');
  const [financialYear, setFinancialYear] = useState(
    tenant.settings?.invoiceDefaults?.financialYear || '2025'
  );
  const [archPrefix, setArchPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.architecture || 'ARCH'
  );
  const [interiorPrefix, setInteriorPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.interior || 'INT'
  );
  const [supervisionPrefix, setSupervisionPrefix] = useState(
    tenant.settings?.invoiceDefaults?.prefix?.supervision || 'SUP'
  );

  const [inviteRole, setInviteRole] = useState<Role>('architect');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const handleSaveCompany = () => {
    if (role !== 'admin') {
      showToast('Permission Denied: Only Admin can update company profile and settings.', {
        type: 'error',
      });
      return;
    }

    updateTenant({
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
  };

  const handleGenerateInvite = () => {
    if (role !== 'admin') {
      showToast('Permission Denied: Only Admin can generate team invite codes.', {
        type: 'error',
      });
      return;
    }
    const code = generateInvite(inviteRole);
    setGeneratedCode(code);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Settings & Management"
        subtitle="Practice Profile, Invoice Numbering & Team Access Control"
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

        {/* Team Members & Invite Generator */}
        <Card>
          <Text style={styles.cardTitle}>Team Members & Invites ({members.length})</Text>

          <View style={styles.inviteBox}>
            <Text style={styles.inviteTitle}>Generate New Team Member Invite Code</Text>
            <View style={styles.rolePickerRow}>
              <Text style={styles.rolePickerLabel}>Role:</Text>
              {(['architect', 'viewer', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, inviteRole === r && styles.roleBtnActive]}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={[styles.roleBtnText, inviteRole === r && styles.roleBtnTextActive]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              <Button
                title="Generate Code"
                onPress={handleGenerateInvite}
                disabled={role !== 'admin'}
                size="sm"
              />
            </View>

            {generatedCode && (
              <View style={styles.codeSuccessBox}>
                <Text style={styles.codeSuccessLabel}>Active Invite Code:</Text>
                <Text style={styles.codeSuccessValue}>{generatedCode}</Text>
                <Text style={styles.codeSuccessSub}>
                  Share this code with your colleague to join as {inviteRole.toUpperCase()}.
                </Text>
              </View>
            )}
          </View>

          {/* Members List */}
          {members.map((m) => (
            <View key={m.uid} style={styles.memberRow}>
              <View style={styles.memberLeft}>
                <Text style={styles.memberName}>{m.displayName || m.email}</Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
              </View>
              <Badge label={m.role} variant={m.role === 'admin' ? 'active' : 'default'} />
            </View>
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
  inviteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inviteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  roleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  roleBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  roleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleBtnTextActive: {
    color: '#ffffff',
  },
  codeSuccessBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
  },
  codeSuccessLabel: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  codeSuccessValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 2,
    marginVertical: 4,
  },
  codeSuccessSub: {
    fontSize: 11,
    color: '#047857',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberLeft: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  memberEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
