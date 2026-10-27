import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ProjectType } from '../../types';
import { useToast } from '../../context/ToastContext';

export const CreateProjectScreen: React.FC = () => {
  const { createProject, navigateTo, members, tenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('residential');
  const [area, setArea] = useState('2500');
  const [unit, setUnit] = useState<'sqft' | 'sqm'>('sqft');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [archRate, setArchRate] = useState('150');
  const [interiorRate, setInteriorRate] = useState('220');
  const [supervisionRate, setSupervisionRate] = useState('50');
  const [assignedArchitects, setAssignedArchitects] = useState<string[]>([
    user?.displayName || 'Ar. Lead',
  ]);
  const [loading, setLoading] = useState(false);

  const toggleArchitect = (name: string) => {
    if (assignedArchitects.includes(name)) {
      setAssignedArchitects(assignedArchitects.filter((a) => a !== name));
    } else {
      setAssignedArchitects([...assignedArchitects, name]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Project name is required.', { type: 'error' });
      return;
    }
    if (!clientName.trim()) {
      showToast('Client name is required.', { type: 'error' });
      return;
    }

    const numericArea = parseFloat(area) || 0;
    if (numericArea <= 0) {
      showToast('Please enter a valid project area.', { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await createProject({
        tenantId: tenant.id,
        name: name.trim(),
        type,
        area: numericArea,
        unit,
        clientName: clientName.trim(),
        location: location.trim(),
        assignedArchitects,
        rateCard: {
          architecture: parseFloat(archRate) || 0,
          interior: parseFloat(interiorRate) || 0,
          supervision: parseFloat(supervisionRate) || 0,
        },
        startDate: new Date().toISOString(),
        status: 'active',
        createdBy: user?.uid || 'user-1',
      });
      navigateTo('projects');
    } catch (e: any) {
      showToast(e.message || 'Failed to create project', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Create Project"
        subtitle="Define commissioning details, scope area, and rate cards"
        showBack
        onBack={() => navigateTo('projects')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionHeader}>General Information</Text>

          <Input
            label="Project Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Modern Minimalist Residence"
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Project Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeBtn, type === 'residential' && styles.typeBtnActive]}
                  onPress={() => setType('residential')}
                >
                  <Text style={[styles.typeBtnText, type === 'residential' && styles.typeBtnTextActive]}>
                    Residential
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, type === 'commercial' && styles.typeBtnActive]}
                  onPress={() => setType('commercial')}
                >
                  <Text style={[styles.typeBtnText, type === 'commercial' && styles.typeBtnTextActive]}>
                    Commercial
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Covered Area & Unit</Text>
              <View style={styles.areaRow}>
                <Input
                  value={area}
                  onChangeText={setArea}
                  placeholder="2500"
                  keyboardType="numeric"
                  containerStyle={{ flex: 1, marginBottom: 0 }}
                />
                <View style={styles.unitSelector}>
                  <TouchableOpacity
                    style={[styles.unitBtn, unit === 'sqft' && styles.unitBtnActive]}
                    onPress={() => setUnit('sqft')}
                  >
                    <Text style={[styles.unitBtnText, unit === 'sqft' && styles.unitBtnTextActive]}>sqft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitBtn, unit === 'sqm' && styles.unitBtnActive]}
                    onPress={() => setUnit('sqm')}
                  >
                    <Text style={[styles.unitBtnText, unit === 'sqm' && styles.unitBtnTextActive]}>sqm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <Input
              label="Client Name *"
              value={clientName}
              onChangeText={setClientName}
              placeholder="e.g. Tariq Mehmood"
              containerStyle={styles.col}
            />
            <Input
              label="Location / Site Address"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. DHA Phase 6, Lahore"
              containerStyle={styles.col}
            />
          </View>

          <Text style={styles.sectionHeader}>Default Rate Card (PKR / {unit})</Text>
          <Text style={styles.rateCardSub}>
            Used to automatically compute line item amounts when creating invoices for this project.
          </Text>

          <View style={styles.row}>
            <Input
              label="Architecture (PKR)"
              value={archRate}
              onChangeText={setArchRate}
              keyboardType="numeric"
              containerStyle={styles.col}
            />
            <Input
              label="Interior Design (PKR)"
              value={interiorRate}
              onChangeText={setInteriorRate}
              keyboardType="numeric"
              containerStyle={styles.col}
            />
            <Input
              label="Supervision (PKR)"
              value={supervisionRate}
              onChangeText={setSupervisionRate}
              keyboardType="numeric"
              containerStyle={styles.col}
            />
          </View>

          <Text style={styles.sectionHeader}>Assign Architects</Text>
          <View style={styles.architectsChipsWrap}>
            {members.map((m) => {
              const isSelected = assignedArchitects.includes(m.displayName || m.email || '');
              const nameToShow = m.displayName || m.email || 'Member';
              return (
                <TouchableOpacity
                  key={m.uid}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleArchitect(nameToShow)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {isSelected ? '✓ ' : '+ '}
                    {nameToShow} ({m.role})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionsWrap}>
            <Button
              title="Cancel"
              onPress={() => navigateTo('projects')}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="Create Project"
              onPress={handleCreate}
              loading={loading}
              style={{ flex: 2 }}
            />
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
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    padding: 24,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
  },
  rateCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  col: {
    flex: 1,
    minWidth: 240,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    height: 44,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  typeBtnTextActive: {
    color: '#0f172a',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    height: 44,
  },
  unitBtn: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: '#ffffff',
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  unitBtnTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  architectsChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
