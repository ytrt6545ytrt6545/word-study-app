import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { THEME } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  helper?: string;
  variant?: 'default' | 'outlined' | 'filled';
  showPasswordToggle?: boolean;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  required,
  disabled,
  leftIcon,
  rightIcon,
  onRightIconPress,
  helper,
  variant = 'default',
  showPasswordToggle = false,
  secureTextEntry: initialSecureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!initialSecureTextEntry);

  const containerStyle: ViewStyle = {
    opacity: disabled ? 0.5 : 1,
  };

  const inputBorderColor = error
    ? THEME.colors.semantic.error
    : isFocused
    ? THEME.colors.primary
    : THEME.colors.border;

  return (
    <View style={containerStyle}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          getVariantStyle(variant, inputBorderColor, isFocused),
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon && { marginLeft: THEME.spacing.sm },
            rightIcon && { marginRight: THEME.spacing.sm },
          ]}
          placeholder={placeholder}
          placeholderTextColor={THEME.colors.gray[400]}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={
            showPasswordToggle ? !showPassword : initialSecureTextEntry
          }
          {...props}
        />

        {showPasswordToggle ? (
          <Pressable
            style={styles.rightIconButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color={THEME.colors.gray[500]}
            />
          </Pressable>
        ) : (
          rightIcon && (
            <Pressable
              style={styles.rightIconButton}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
            >
              {rightIcon}
            </Pressable>
          )
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons
            name="error"
            size={14}
            color={THEME.colors.semantic.error}
            style={{ marginRight: THEME.spacing.xs }}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!error && helper && (
        <Text style={styles.helperText}>{helper}</Text>
      )}
    </View>
  );
}

function getVariantStyle(
  variant: 'default' | 'outlined' | 'filled',
  borderColor: string,
  isFocused: boolean,
): ViewStyle {
  switch (variant) {
    case 'outlined':
      return {
        borderWidth: 2,
        borderColor: isFocused ? THEME.colors.primary : borderColor,
        backgroundColor: THEME.colors.surface,
      };
    case 'filled':
      return {
        borderWidth: 0,
        borderBottomWidth: 2,
        borderBottomColor: borderColor,
        backgroundColor: THEME.colors.gray[50],
      };
    case 'default':
    default:
      return {
        borderWidth: 1.5,
        borderColor: borderColor,
        backgroundColor: THEME.colors.gray[50],
      };
  }
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  label: {
    ...THEME.typography.label,
    color: THEME.colors.gray[900],
    fontWeight: '600',
  },
  required: {
    color: THEME.colors.semantic.error,
    marginLeft: THEME.spacing.xs,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    minHeight: 48,
  },
  leftIcon: {
    marginRight: THEME.spacing.sm,
  },
  input: {
    flex: 1,
    ...THEME.typography.body,
    color: THEME.colors.gray[900],
    padding: 0,
  },
  rightIconButton: {
    padding: THEME.spacing.sm,
    marginLeft: THEME.spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: THEME.spacing.xs,
  },
  errorText: {
    ...THEME.typography.caption,
    color: THEME.colors.semantic.error,
    fontWeight: '500',
  },
  helperText: {
    ...THEME.typography.caption,
    color: THEME.colors.gray[500],
    marginTop: THEME.spacing.xs,
  },
});
