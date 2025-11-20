import { THEME } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ViewStyle
} from 'react-native';

interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'destructive' | 'secondary';
}

interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: DialogAction[];
  onDismiss?: () => void;
  closeButton?: boolean;
  maxHeight?: number | string;
  testID?: string;
}

export function Dialog({
  visible,
  title,
  description,
  children,
  actions,
  onDismiss,
  closeButton = true,
  maxHeight = '80%',
}: DialogProps) {
  const defaultActions: DialogAction[] = actions || [
    {
      label: '關閉',
      onPress: () => onDismiss?.(),
      variant: 'secondary',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        style={styles.overlay}
        onPress={onDismiss}
      >
        <Pressable
          style={[
            styles.dialog,
            ({ maxHeight } as any),
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {closeButton && (
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onDismiss}
            >
              <MaterialIcons name="close" size={24} color={THEME.colors.gray[500]} />
            </Pressable>
          )}

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {description && (
              <Text style={styles.description}>{description}</Text>
            )}
          </View>

          {children && (
            <ScrollView
              style={styles.content}
              scrollEnabled={typeof maxHeight === 'string'}
            >
              {children}
            </ScrollView>
          )}

          {defaultActions.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.actions}>
                {defaultActions.map((action, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => ([
                      styles.action,
                      getActionStyle(action.variant || 'secondary'),
                      pressed && { opacity: 0.7 },
                    ] as any)}
                    onPress={() => {
                      action.onPress();
                    }}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        getActionTextStyle(action.variant || 'secondary'),
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getActionStyle(
  variant: 'primary' | 'destructive' | 'secondary',
): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: THEME.colors.primary,
        flex: 1,
      };
    case 'destructive':
      return {
        backgroundColor: THEME.colors.semantic.error,
        flex: 1,
      };
    case 'secondary':
    default:
      return {
        backgroundColor: THEME.colors.gray[100],
        flex: 1,
        borderWidth: 1,
        borderColor: THEME.colors.border,
      };
  }
}

function getActionTextStyle(variant: 'primary' | 'destructive' | 'secondary') {
  switch (variant) {
    case 'primary':
    case 'destructive':
      return { color: '#fff' };
    case 'secondary':
    default:
      return { color: THEME.colors.gray[900] };
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  dialog: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    ...THEME.shadows.lg,
  },
  closeButton: {
    position: 'absolute',
    top: THEME.spacing.md,
    right: THEME.spacing.md,
    zIndex: 10,
    padding: THEME.spacing.sm,
  },
  header: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
  },
  title: {
    ...THEME.typography.h3,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.sm,
  },
  description: {
    ...THEME.typography.body,
    color: THEME.colors.gray[600],
  },
  content: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
  },
  footer: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  action: {
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...THEME.typography.label,
    fontWeight: '600',
  },
});
