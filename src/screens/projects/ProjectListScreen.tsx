import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ProjectDoc } from '../../types';

export const ProjectListScreen: React.FC = () => {
  const { projects, navigateTo } = useTenant();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Projects"
        subtitle={`${projects.length} architectural & interior commissions`}
        rightAction={
          <Button
            title="+ New Project"
            onPress={() => navigateTo('create_project')}
            size="sm"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search & Filter Bar */}
        <View style={styles.filterRow}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects by name, client, location..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.tabsRow}>
            {(['active', 'archived', 'all'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterTab, statusFilter === s && styles.filterTabActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    statusFilter === s && styles.filterTabTextActive,
                  ]}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Project Cards Grid */}
        <View style={styles.grid}>
          {filteredProjects.map((project: ProjectDoc) => (
            <Card key={project.id} style={styles.projectCard}>
              <View style={styles.cardHeader}>
                <View style={styles.typeBadgeWrap}>
                  <Badge
                    label={project.type}
                    variant={project.type === 'commercial' ? 'issued' : 'active'}
                  />
                  <Text style={styles.areaText}>
                    {project.area.toLocaleString()} {project.unit}
                  </Text>
                </View>
                <Badge
                  label={project.status}
                  variant={project.status === 'active' ? 'active' : 'default'}
                />
              </View>

              <Text style={styles.projectName}>{project.name}</Text>
              <Text style={styles.clientName}>Client: {project.clientName}</Text>
              {project.location && (
                <Text style={styles.locationText}>📍 {project.location}</Text>
              )}

              {/* Rate Card per Category */}
              <View style={styles.rateCardBox}>
                <Text style={styles.rateCardTitle}>Rate Card (PKR / {project.unit}):</Text>
                <View style={styles.ratesRow}>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>Arch</Text>
                    <Text style={styles.rateVal}>PKR {project.rateCard?.architecture || 0}</Text>
                  </View>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>Interior</Text>
                    <Text style={styles.rateVal}>PKR {project.rateCard?.interior || 0}</Text>
                  </View>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>Supervision</Text>
                    <Text style={styles.rateVal}>PKR {project.rateCard?.supervision || 0}</Text>
                  </View>
                </View>
              </View>

              {/* Architects & Actions */}
              <View style={styles.cardFooter}>
                <Text style={styles.architectsText} numberOfLines={1}>
                  Architects: {project.assignedArchitects?.join(', ') || 'Unassigned'}
                </Text>
                <View style={styles.actionBtnsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => navigateTo('project_detail', { project })}
                  >
                    <Text style={styles.actionBtnText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnSolid}
                    onPress={() => navigateTo('create_invoice', { selectedProject: project })}
                  >
                    <Text style={styles.actionBtnSolidText}>Bill Project</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}

          {filteredProjects.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📐</Text>
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search or filters.</Text>
            </View>
          )}
        </View>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 3,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#ffffff',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#0f172a',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  projectCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  areaText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  projectName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  locationText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  rateCardBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rateCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  ratesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rateCol: {
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  rateVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 6,
  },
  architectsText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtnOutline: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  actionBtnSolid: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  actionBtnSolidText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyWrap: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
});
