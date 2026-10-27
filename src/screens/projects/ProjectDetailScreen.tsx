import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTenant } from '../../context/TenantContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatPKR } from '../../util/currency';
import { formatDate } from '../../util/dates';
import { ProjectDoc } from '../../types';

export const ProjectDetailScreen: React.FC = () => {
  const { currentParams, invoices, navigateTo } = useTenant();
  const project: ProjectDoc = currentParams?.project;

  if (!project) {
    return (
      <View style={styles.container}>
        <Header title="Project Details" showBack onBack={() => navigateTo('projects')} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Project Not Found</Text>
          <Button title="Back to Projects" onPress={() => navigateTo('projects')} />
        </View>
      </View>
    );
  }

  const projectInvoices = invoices.filter((i) => i.projectId === project.id);
  const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <View style={styles.container}>
      <Header
        title={project.name}
        subtitle={`${project.type.toUpperCase()} • ${project.area.toLocaleString()} ${project.unit}`}
        showBack
        onBack={() => navigateTo('projects')}
        rightAction={
          <Button
            title="+ Bill Project"
            onPress={() => navigateTo('create_invoice', { selectedProject: project })}
            size="sm"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Project Info Card */}
        <Card>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.clientLabel}>CLIENT</Text>
              <Text style={styles.clientValue}>{project.clientName}</Text>
              {project.location && (
                <Text style={styles.locationValue}>📍 {project.location}</Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Badge label={project.status} variant={project.status as any} />
              <Text style={styles.dateValue}>Started: {formatDate(project.startDate)}</Text>
            </View>
          </View>

          {/* Rate Cards Box */}
          <View style={styles.rateCardBox}>
            <Text style={styles.boxTitle}>Configured Rate Card (PKR / {project.unit})</Text>
            <View style={styles.ratesGrid}>
              <View style={styles.rateCardItem}>
                <Text style={styles.rateLabel}>Architecture</Text>
                <Text style={styles.rateValue}>PKR {project.rateCard?.architecture || 0}</Text>
              </View>
              <View style={styles.rateCardItem}>
                <Text style={styles.rateLabel}>Interior Design</Text>
                <Text style={styles.rateValue}>PKR {project.rateCard?.interior || 0}</Text>
              </View>
              <View style={styles.rateCardItem}>
                <Text style={styles.rateLabel}>Supervision</Text>
                <Text style={styles.rateValue}>PKR {project.rateCard?.supervision || 0}</Text>
              </View>
            </View>
          </View>

          <View style={styles.architectsRow}>
            <Text style={styles.architectsLabel}>Assigned Architects:</Text>
            <Text style={styles.architectsVal}>
              {project.assignedArchitects?.join(', ') || 'None'}
            </Text>
          </View>
        </Card>

        {/* Project Invoices Section */}
        <Card>
          <View style={styles.invHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Commission Invoices ({projectInvoices.length})</Text>
              <Text style={styles.sectionSub}>Total Invoiced: {formatPKR(totalInvoiced)}</Text>
            </View>
            <Button
              title="Issue New Invoice"
              onPress={() => navigateTo('create_invoice', { selectedProject: project })}
              size="sm"
            />
          </View>

          {projectInvoices.map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={styles.invRow}
              onPress={() =>
                inv.status === 'draft'
                  ? navigateTo('invoice_preview', { invoice: inv })
                  : navigateTo('pdf_viewer', { invoice: inv })
              }
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.invSerial}>{inv.serial}</Text>
                <Text style={styles.invCategory}>Category: {inv.category.toUpperCase()}</Text>
                <Text style={styles.invDate}>{formatDate(inv.createdAt)}</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invTotal}>{formatPKR(inv.total)}</Text>
                <Badge label={inv.status} variant={inv.status as any} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          ))}

          {projectInvoices.length === 0 && (
            <View style={styles.emptyInvoices}>
              <Text style={styles.emptyInvoicesText}>No invoices issued for this project yet.</Text>
            </View>
          )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  clientLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  clientValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  locationValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  dateValue: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },
  rateCardBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  boxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  ratesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rateCardItem: {
    alignItems: 'center',
    flex: 1,
  },
  rateLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  architectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  architectsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 6,
  },
  architectsVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '500',
  },
  invHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  invSerial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  invCategory: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  invDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  invTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
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
  emptyInvoices: {
    padding: 24,
    alignItems: 'center',
  },
  emptyInvoicesText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
