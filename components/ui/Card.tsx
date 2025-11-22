import { THEME } from '@/constants/Colors';
import React, { PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewProps } from 'react-native';

// Simplified variants. 'elevated' is now the default visual style.
type CardVariant = 'default';

interface CardProps extends ViewProps {
  pressable?: false;
  variant?: CardVariant;
}

interface PressableCardProps extends Omit<PressableProps, 'children'> {
  pressable: true;
  variant?: CardVariant;
}

type Props = PropsWithChildren<CardProps | PressableCardProps>;

export function Card({
  children,
  style,
  ...props
}: Props) {
  const isPressable = 'pressable' in props && props.pressable;

  const baseStyle = [
    styles.card,
    style,
  ];

  if (isPressable) {
    const { pressable, ...pressableProps } = props as PressableCardProps;
    return (
      <Pressable
        style={({ pressed }) => [
          ...baseStyle,
          pressed && styles.pressed,
        ]}
        {...pressableProps}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={baseStyle} {...(props as CardProps)}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl, // Slightly larger radius for a softer look
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.md, // Consistent shadow style
    padding: THEME.spacing.lg,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    ...THEME.shadows.sm, // Reduce shadow on press
  },
});
