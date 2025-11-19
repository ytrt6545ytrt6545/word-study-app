import React, { PropsWithChildren } from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { THEME } from '@/constants/Colors';

interface EmptyStateProps extends ViewProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  style,
}: PropsWithChildren<EmptyStateProps>) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: THEME.spacing.xxxl * 2,
    paddingHorizontal: THEME.spacing.lg,
  },
  icon: {
    fontSize: 48,
    marginBottom: THEME.spacing.lg,
  },
  title: {
    fontSize: THEME.typography.subtitle.fontSize,
    fontWeight: THEME.typography.subtitle.fontWeight,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: THEME.typography.body.fontSize,
    color: THEME.colors.gray[500],
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
    lineHeight: 22,
  },
  actionContainer: {
    marginTop: THEME.spacing.lg,
  },
});
