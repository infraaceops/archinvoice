import React, { useState } from 'react';
import { Share, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { TeamInvitationResult } from '../../types';
import { useToast } from '../../context/ToastContext';

export const SettingsScreen: React.FC = () => {
  const { tenant, updateTenant, members, invitations, refreshTeam, inviteTeamMember, removeTeamMember } = useTenant();
  const { role, user } = useAuth();
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

  const [teamEmail, setTeamEmail] = useState('');
  const [teamPhone, setTeamPhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'architect' | 'viewer'>('architect');
  const [invitation, setInvitation] = useState<TeamInvitationResult | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

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

  const handleInviteTeamMember = async () => {
    if (role !== 'admin') {
      showToast('Permission denied: only company admins can invite team members.', {
        type: 'error',
      });
      return;
    }
    setTeamLoading(true);
    try {
      const created = await inviteTeamMember({
        email: teamEmail.trim(),
        phone: teamPhone.trim() || undefined,
        role: inviteRole,
      });
      setInvitation(created);
      setTeamEmail('');
      setTeamPhone('');
      try {
        await Share.share({
          title: 'ArchInvoice team invitation',
          message: `You have been invited to join ${tenant.name} as ${inviteRole}. Sign in with ${teamEmail.trim()} and open this invite link: ${created.inviteLink}`,
          url: created.inviteLink,
        });
      } catch (shareError) {
        console.warn('Invitation created; system sharing is unavailable.', shareError);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create invitation.', { type: 'error' });
    } finally {
      setTeamLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    setTeamLoading(true);
    try {
      await removeTeamMember(removingMember);
      setRemovingMember(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not remove team member.', { type: 'error' });
    } finally {
      setTeamLoading(false);
    }
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

        {/* Team Members & Secure Invitations */}
        <Card>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Team members ({members.length})</Text>
            <TouchableOpacity onPress={() => void refreshTeam().catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Could not refresh team.', { type: 'error' }))}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inviteBox}>
            <Text style={styles.inviteTitle}>Invite by email and contact number</Text>
            <Text style={styles.cardSubtitle}>
              The invite is one-time, expires after 7 days, and only the invited verified Google email can accept it.
            </Text>
            <Input
              label="Team member email *"
              value={teamEmail}
              onChangeText={setTeamEmail}
              placeholder="architect@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Phone number (optional)"
              value={teamPhone}
              onChangeText={setTeamPhone}
              placeholder="+92 300 1234567"
              keyboardType="phone-pad"
            />
            <View style={styles.rolePickerRow}>
              <Text style={styles.rolePickerLabel}>Role:</Text>
              {(['architect', 'viewer'] as const).map((r) => (
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
                title="Create secure invite"
                onPress={() => void handleInviteTeamMember()}
                disabled={role !== 'admin' || !teamEmail.trim() || teamLoading}
                loading={teamLoading}
                size="sm"
              />
            </View>

            {invitation && (
              <View style={styles.codeSuccessBox}>
                <Text style={styles.codeSuccessLabel}>Secure invite link · expires {new Date(invitation.expiresAt).toLocaleString()}</Text>
                <Text selectable style={styles.inviteLink}>{invitation.inviteLink}</Text>
                <Text style={styles.codeSuccessSub}>Share this link with the invited email recipient. They must sign in with that Google account.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionHeading}>Active members</Text>
          {members.map((m) => (
            <View key={m.uid} style={styles.memberRow}>
              <View style={styles.memberLeft}>
                <Text style={styles.memberName}>{m.displayName || m.email || m.uid}</Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
                {m.phone ? <Text style={styles.memberEmail}>{m.phone}</Text> : null}
              </View>
              <View style={styles.memberActions}>
                <Badge label={m.role} variant={m.role === 'admin' ? 'active' : 'default'} />
                {role === 'admin' && m.uid !== user?.uid && m.role !== 'admin' && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setRemovingMember(m.uid)}
                    disabled={teamLoading}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {members.length === 0 && <Text style={styles.cardSubtitle}>No company team members were returned.</Text>}

          {removingMember && (
            <View style={styles.removeConfirm}>
              <Text style={styles.removeConfirmText}>Remove this member’s access to company data?</Text>
              <View style={styles.rolePickerRow}>
                <Button title="Cancel" variant="outline" size="sm" onPress={() => setRemovingMember(null)} />
                <Button title="Confirm removal" variant="danger" size="sm" loading={teamLoading} onPress={() => void handleRemoveMember()} />
              </View>
            </View>
          )}

          <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Pending invitations ({invitations.length})</Text>
          {invitations.map((invite) => (
            <View key={invite.id} style={styles.memberRow}>
              <View style={styles.memberLeft}>
                <Text style={styles.memberName}>{invite.email}</Text>
                {invite.phone ? <Text style={styles.memberEmail}>{invite.phone}</Text> : null}
                <Text style={styles.memberEmail}>Expires {new Date(invite.expiresAt).toLocaleDateString()}</Text>
              </View>
              <Badge label={invite.role} variant="grace" />
            </View>
          ))}
          {role !== 'admin' && <Text style={styles.cardSubtitle}>Only company admins can invite or remove members.</Text>}
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
  refreshText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  sectionHeading: { fontSize: 12, fontWeight: '800', color: '#475569', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  inviteLink: { color: '#1d4ed8', fontSize: 12, marginTop: 5, marginBottom: 4 },
  memberActions: { alignItems: 'flex-end', gap: 7 },
  removeButton: { paddingVertical: 5, paddingHorizontal: 9, backgroundColor: '#fef2f2', borderRadius: 6 },
  removeButtonText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  removeConfirm: { marginTop: 14, padding: 12, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8 },
  removeConfirmText: { fontSize: 13, fontWeight: '700', color: '#9a3412', marginBottom: 8 },
});
