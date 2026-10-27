import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  label: string;
  used: string;
  total: string;
  percentage: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  used,
  total,
  percentage,
}) => {
  const safePercentage = Math.min(Math.max(percentage, 0), 100);

  const getBarColor = () => {
    if (safePercentage > 90) return '#dc2626'; // Red
    if (safePercentage > 75) return '#f59e0b'; // Amber
    return '#2563eb'; // Blue
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.metrics}>
          {used} / {total} ({safePercentage.toFixed(1)}%)
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safePercentage}%`, backgroundColor: getBarColor() }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  metrics: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  track: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
