import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { THEME } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Dialog } from './Dialog';

interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  value?: string | number;
  options: SelectOption[];
  onValueChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  variant?: 'default' | 'outlined';
}

export function Select({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  required = false,
  variant = 'default',
}: SelectProps) {
  const [showDialog, setShowDialog] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || placeholder;

  const containerStyle: ViewStyle = {
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <View style={containerStyle}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          variant === 'outlined' && styles.triggerOutlined,
          error && styles.triggerError,
          pressed && !disabled && { backgroundColor: THEME.colors.gray[50] },
        ]}
        onPress={() => !disabled && setShowDialog(true)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        <MaterialIcons
          name="unfold-more"
          size={20}
          color={error ? THEME.colors.semantic.error : THEME.colors.gray[500]}
        />
      </Pressable>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Dialog
        visible={showDialog}
        title={label || 'Select option'}
        onDismiss={() => setShowDialog(false)}
        actions={[
          {
            label: 'Close',
            onPress: () => setShowDialog(false),
            variant: 'secondary',
          },
        ]}
      >
        <ScrollView style={styles.optionsList}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.option,
                option.value === value && styles.optionSelected,
                option.disabled && styles.optionDisabled,
                pressed && !option.disabled && { backgroundColor: THEME.colors.gray[100] },
              ]}
              onPress={() => {
                if (!option.disabled) {
                  onValueChange(option.value);
                  setShowDialog(false);
                }
              }}
              disabled={option.disabled}
            >
              <Text
                style={[
                  styles.optionLabel,
                  option.value === value && styles.optionLabelSelected,
                  option.disabled && styles.optionLabelDisabled,
                ]}
              >
                {option.label}
              </Text>
              {option.value === value && (
                <MaterialIcons
                  name="check"
                  size={20}
                  color={THEME.colors.primary}
                />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </Dialog>
    </View>
  );
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
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.gray[50],
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  triggerOutlined: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.border,
  },
  triggerError: {
    borderColor: THEME.colors.semantic.error,
  },
  triggerText: {
    flex: 1,
    ...THEME.typography.body,
    color: THEME.colors.gray[900],
  },
  triggerPlaceholder: {
    color: THEME.colors.gray[400],
  },
  errorText: {
    ...THEME.typography.caption,
    color: THEME.colors.semantic.error,
    marginTop: THEME.spacing.xs,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  optionSelected: {
    backgroundColor: THEME.colors.primaryLight,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionLabel: {
    flex: 1,
    ...THEME.typography.body,
    color: THEME.colors.gray[900],
  },
  optionLabelSelected: {
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  optionLabelDisabled: {
    color: THEME.colors.gray[400],
  },
});
