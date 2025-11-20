import { THEME } from '@/constants/Colors';
import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: string | React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const getVariantStyles = (
  variant: ButtonVariant,
): {
  container: ViewStyle;
  text: TextStyle;
} => {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: THEME.colors.primary,
        },
        text: {
          color: '#fff',
        },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: THEME.colors.gray[100],
          borderWidth: 1.5,
          borderColor: THEME.colors.border,
        },
        text: {
          color: THEME.colors.gray[900],
        },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: THEME.colors.primary,
        },
        text: {
          color: THEME.colors.primary,
        },
      };
    case 'destructive':
      return {
        container: {
          backgroundColor: THEME.colors.semantic.error,
        },
        text: {
          color: '#fff',
        },
      };
    case 'success':
      return {
        container: {
          backgroundColor: THEME.colors.semantic.success,
        },
        text: {
          color: '#fff',
        },
      };
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        paddingVertical: THEME.spacing.sm,
        paddingHorizontal: THEME.spacing.md,
        fontSize: 13,
        height: 36,
      };
    case 'lg':
      return {
        paddingVertical: THEME.spacing.lg,
        paddingHorizontal: THEME.spacing.xl,
        fontSize: 16,
        height: 52,
      };
    case 'md':
    default:
      return {
        paddingVertical: THEME.spacing.md,
        paddingHorizontal: THEME.spacing.lg,
        fontSize: 14,
        height: 44,
      };
  }
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  style,
  icon,
  iconPosition = 'left',
  ...props
}: ButtonProps) {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const isDisabled = disabled || loading;

  const childrenText = typeof children === 'string' ? children : null;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => ([
        styles.button,
        variantStyles.container,
        sizeStyles,
        fullWidth && { flex: 1 },
        isDisabled && { opacity: 0.6 },
        pressed && !isDisabled && {
          opacity: 0.9,
          transform: [{ scale: 0.96 }],
        },
        style,
      ] as any)}
      {...props}
    >
      <Pressable
        style={styles.contentContainer}
        onPress={(e) => {
          e.stopPropagation();
        }}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variantStyles.text.color}
            style={{ marginRight: THEME.spacing.sm }}
          />
        ) : (
          icon && iconPosition === 'left' && icon
        )}
        {childrenText && (
          <Text
            style={[
              styles.text,
              variantStyles.text,
              { fontSize: sizeStyles.fontSize },
              loading && { marginLeft: THEME.spacing.sm },
            ]}
          >
            {childrenText}
          </Text>
        )}
        {!loading && icon && iconPosition === 'right' && (
          <View style={{ marginLeft: THEME.spacing.sm }}>
            {icon}
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});

import { View } from 'react-native';

