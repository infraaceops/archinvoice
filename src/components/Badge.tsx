import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'draft' | 'issued' | 'paid' | 'cancelled' | 'active' | 'grace' | 'locked' | 'default';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style }) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'active':
      case 'paid':
        return { bg: '#dcfce7', text: '#15803d' }; // Emerald
      case 'issued':
        return { bg: '#dbeafe', text: '#1d4ed8' }; // Blue
      case 'grace':
        return { bg: '#fef3c7', text: '#b45309' }; // Amber
      case 'locked':
      case 'cancelled':
        return { bg: '#fee2e2', text: '#b91c1c' }; // Red
      case 'draft':
        return { bg: '#f1f5f9', text: '#475569' }; // Slate
      default:
        return { bg: '#e2e8f0', text: '#334155' };
    }
  };

  const colors = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
