import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { THEME } from '@/constants/Colors';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: string | React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const getVariantStyles = (
  variant: BadgeVariant,
): {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
} => {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: THEME.colors.primary,
        textColor: '#fff',
      };
    case 'secondary':
      return {
        backgroundColor: THEME.colors.gray[100],
        textColor: THEME.colors.gray[900],
        borderColor: THEME.colors.border,
      };
    case 'success':
      return {
        backgroundColor: THEME.colors.semantic.success,
        textColor: '#fff',
      };
    case 'warning':
      return {
        backgroundColor: THEME.colors.semantic.warning,
        textColor: '#fff',
      };
    case 'error':
      return {
        backgroundColor: THEME.colors.semantic.error,
        textColor: '#fff',
      };
    case 'info':
      return {
        backgroundColor: THEME.colors.semantic.info,
        textColor: '#fff',
      };
  }
};

const getSizeStyles = (size: BadgeSize) => {
  switch (size) {
    case 'sm':
      return {
        paddingHorizontal: THEME.spacing.sm,
        paddingVertical: THEME.spacing.xs,
        fontSize: 11,
        height: 20,
      };
    case 'lg':
      return {
        paddingHorizontal: THEME.spacing.lg,
        paddingVertical: THEME.spacing.sm,
        fontSize: 14,
        height: 32,
      };
    case 'md':
    default:
      return {
        paddingHorizontal: THEME.spacing.md,
        paddingVertical: THEME.spacing.xs,
        fontSize: 12,
        height: 24,
      };
  }
};

export function Badge({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  icon,
  style,
}: BadgeProps) {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const childrenText = typeof children === 'string' ? children : null;

  const Component = onPress ? Pressable : View;

  return (
    <Component
      style={({ pressed }: any) => [
        styles.badge,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderColor ? 1 : 0,
        },
        sizeStyles,
        onPress && pressed && { opacity: 0.7 },
        style,
      ]}
      onPress={onPress}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      {childrenText && (
        <Text
          style={[
            styles.text,
            {
              color: variantStyles.textColor,
              fontSize: sizeStyles.fontSize,
            },
          ]}
          numberOfLines={1}
        >
          {childrenText}
        </Text>
      )}
      {typeof children !== 'string' && children}
    </Component>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.full,
    gap: THEME.spacing.xs,
  },
  icon: {
    marginRight: -THEME.spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
});
