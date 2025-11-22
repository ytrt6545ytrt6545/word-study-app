import { THEME } from '@/constants/Colors';
import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

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

const getVariantStyles = (variant: ButtonVariant): { container: ViewStyle; text: TextStyle } => {
  switch (variant) {
    case 'primary':
      return { container: { backgroundColor: THEME.colors.primary }, text: { color: '#fff' } };
    case 'secondary':
      return {
        container: { backgroundColor: THEME.colors.gray[100], borderWidth: 1, borderColor: THEME.colors.border },
        text: { color: THEME.colors.gray[900] },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: THEME.colors.primary },
        text: { color: THEME.colors.primary },
      };
    case 'destructive':
      return { container: { backgroundColor: THEME.colors.semantic.error }, text: { color: '#fff' } };
    case 'success':
      return { container: { backgroundColor: THEME.colors.semantic.success }, text: { color: '#fff' } };
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return { paddingVertical: THEME.spacing.sm, paddingHorizontal: THEME.spacing.md, fontSize: 13, height: 36 };
    case 'lg':
      return { paddingVertical: THEME.spacing.lg, paddingHorizontal: THEME.spacing.xl, fontSize: 16, height: 52 };
    case 'md':
    default:
      return { paddingVertical: THEME.spacing.md, paddingHorizontal: THEME.spacing.lg, fontSize: 14, height: 44 };
  }
};

const ButtonComponent = ({
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
}: ButtonProps) => {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const isDisabled = disabled || loading;

  const childrenText = typeof children === 'string' ? children : null;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyles.container,
        sizeStyles,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        // Apply shadows and transform only for primary/success/destructive variants
        (variant === 'primary' || variant === 'success' || variant === 'destructive') && {
          ...(pressed && !isDisabled ? styles.pressed : styles.notPressed),
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator size="small" color={variantStyles.text.color} style={styles.iconSpacing} />
        ) : (
          icon && iconPosition === 'left' && <View style={styles.iconSpacing}>{icon}</View>
        )}
        {childrenText && (
          <Text style={[styles.text, variantStyles.text, { fontSize: sizeStyles.fontSize }]}>
            {childrenText}
          </Text>
        )}
        {!loading && icon && iconPosition === 'right' && (
          <View style={styles.iconSpacingRight}>{icon}</View>
        )}
      </View>
    </Pressable>
  );
};

export const Button = React.memo(ButtonComponent);

const styles = StyleSheet.create({
  button: {
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // Allow shadow to be visible
    flexDirection: 'row',
  },
  fullWidth: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...THEME.typography.label,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    ...THEME.shadows.sm,
    transform: [{ scale: 0.98 }],
  },
  notPressed: {
    ...THEME.shadows.md,
  },
  iconSpacing: {
    marginRight: THEME.spacing.sm,
  },
  iconSpacingRight: {
    marginLeft: THEME.spacing.sm,
  },
});

