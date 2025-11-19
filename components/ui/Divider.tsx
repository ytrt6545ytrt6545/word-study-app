import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { THEME } from '@/constants/Colors';

interface DividerProps extends ViewProps {
  vertical?: boolean;
  spacing?: 'sm' | 'md' | 'lg';
}

export function Divider({
  vertical = false,
  spacing = 'md',
  style,
}: DividerProps) {
  const spacingValues = {
    sm: THEME.spacing.sm,
    md: THEME.spacing.md,
    lg: THEME.spacing.lg,
  };

  if (vertical) {
    return (
      <View
        style={[
          {
            width: 1,
            backgroundColor: THEME.colors.border,
            height: '100%',
            marginHorizontal: spacingValues[spacing],
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: THEME.colors.border,
          marginVertical: spacingValues[spacing],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({});
