import { THEME } from '@/constants/Colors';
import React, { PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  pressable?: false;
}

interface PressableCardProps extends Omit<PressableProps, 'children'> {
  variant?: 'default' | 'elevated' | 'outlined';
  pressable: true;
}

type Props = PropsWithChildren<CardProps | PressableCardProps>;

export function Card({
  children,
  variant = 'default',
  style,
  ...props
}: Props) {
  const pressable = 'pressable' in props && props.pressable;
  const isPressable = pressable as boolean;

  const baseStyle = [
    styles.card,
    getVariantStyle(variant),
    style,
  ];

    if (isPressable) {
    const { pressable, ...pressableProps } = props as PressableCardProps;
    return (
      <Pressable
        style={({ pressed }) => ([
          ...baseStyle,
          pressed && { opacity: 0.8 },
        ] as any)}
        {...pressableProps}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={baseStyle as any} {...(props as CardProps)}>
      {children}
    </View>
  );
}

function getVariantStyle(variant: 'default' | 'elevated' | 'outlined') {
  switch (variant) {
    case 'elevated':
      return [
        styles.elevated,
        THEME.shadows.lg,
      ];
    case 'outlined':
      return styles.outlined;
    case 'default':
    default:
      return [
        styles.default,
        THEME.shadows.md,
      ];
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surface,
  },
  default: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  elevated: {
    borderWidth: 0,
  },
  outlined: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surfaceAlt,
  },
});
