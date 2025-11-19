import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { THEME } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface Step {
  label: string;
  description?: string;
  completed?: boolean;
  error?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepPress?: (stepIndex: number) => void;
  variant?: 'horizontal' | 'vertical';
}

export function Stepper({
  steps,
  currentStep,
  onStepPress,
  variant = 'horizontal',
}: StepperProps) {
  if (variant === 'horizontal') {
    return (
      <View style={styles.horizontalContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <Pressable
              style={({ pressed }) => [
                styles.stepCircle,
                getStepCircleStyle(index, currentStep, step),
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onStepPress?.(index)}
              disabled={!onStepPress}
            >
              {step.completed && !step.error ? (
                <MaterialIcons
                  name="check"
                  size={20}
                  color="#fff"
                />
              ) : step.error ? (
                <MaterialIcons
                  name="close"
                  size={20}
                  color="#fff"
                />
              ) : (
                <Text style={styles.stepNumber}>{index + 1}</Text>
              )}
            </Pressable>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  step.completed && styles.stepConnectorCompleted,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.verticalContainer}>
      {steps.map((step, index) => (
        <View key={index} style={styles.verticalStepRow}>
          <View style={styles.verticalStepContent}>
            <Pressable
              style={({ pressed }) => [
                styles.stepCircle,
                getStepCircleStyle(index, currentStep, step),
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onStepPress?.(index)}
              disabled={!onStepPress}
            >
              {step.completed && !step.error ? (
                <MaterialIcons
                  name="check"
                  size={20}
                  color="#fff"
                />
              ) : step.error ? (
                <MaterialIcons
                  name="close"
                  size={20}
                  color="#fff"
                />
              ) : (
                <Text style={styles.stepNumber}>{index + 1}</Text>
              )}
            </Pressable>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.verticalConnector,
                  step.completed && styles.verticalConnectorCompleted,
                ]}
              />
            )}
          </View>

          <View style={styles.stepLabels}>
            <Text style={styles.stepLabel}>{step.label}</Text>
            {step.description && (
              <Text style={styles.stepDescription}>{step.description}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function getStepCircleStyle(
  index: number,
  currentStep: number,
  step: Step,
): ViewStyle {
  if (step.error) {
    return {
      backgroundColor: THEME.colors.semantic.error,
    };
  }

  if (step.completed) {
    return {
      backgroundColor: THEME.colors.semantic.success,
    };
  }

  if (index === currentStep) {
    return {
      backgroundColor: THEME.colors.primary,
      borderWidth: 3,
      borderColor: THEME.colors.primaryLight,
    };
  }

  if (index < currentStep) {
    return {
      backgroundColor: THEME.colors.gray[300],
    };
  }

  return {
    backgroundColor: THEME.colors.gray[100],
    borderWidth: 2,
    borderColor: THEME.colors.border,
  };
}

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.lg,
    backgroundColor: THEME.colors.surfaceAlt,
    borderRadius: THEME.radius.md,
  },
  verticalContainer: {
    paddingVertical: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.lg,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNumber: {
    color: THEME.colors.gray[600],
    fontWeight: '600',
    fontSize: 16,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: THEME.colors.gray[200],
    marginHorizontal: THEME.spacing.sm,
  },
  stepConnectorCompleted: {
    backgroundColor: THEME.colors.semantic.success,
  },
  verticalStepRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.xl,
  },
  verticalStepContent: {
    alignItems: 'center',
    marginRight: THEME.spacing.lg,
  },
  verticalConnector: {
    width: 2,
    height: 80,
    backgroundColor: THEME.colors.gray[200],
    marginTop: THEME.spacing.sm,
  },
  verticalConnectorCompleted: {
    backgroundColor: THEME.colors.semantic.success,
  },
  stepLabels: {
    flex: 1,
    justifyContent: 'center',
  },
  stepLabel: {
    ...THEME.typography.subtitle,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.xs,
  },
  stepDescription: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.gray[500],
  },
});
