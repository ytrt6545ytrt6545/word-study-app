import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, ViewStyle, TextStyle } from 'react-native';
import { THEME } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastPosition = 'top' | 'bottom' | 'center';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  position?: ToastPosition;
  duration?: number;
  onDismiss?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const getToastStyles = (type: ToastType): {
  backgroundColor: string;
  textColor: string;
  iconColor: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
} => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: THEME.colors.semantic.success,
        textColor: '#fff',
        iconColor: '#fff',
        icon: 'check-circle',
      };
    case 'error':
      return {
        backgroundColor: THEME.colors.semantic.error,
        textColor: '#fff',
        iconColor: '#fff',
        icon: 'error',
      };
    case 'warning':
      return {
        backgroundColor: THEME.colors.semantic.warning,
        textColor: '#fff',
        iconColor: '#fff',
        icon: 'warning',
      };
    case 'info':
    default:
      return {
        backgroundColor: THEME.colors.primary,
        textColor: '#fff',
        iconColor: '#fff',
        icon: 'info',
      };
  }
};

const getPositionStyle = (position: ToastPosition): ViewStyle => {
  switch (position) {
    case 'top':
      return { top: THEME.spacing.lg };
    case 'center':
      return { top: '50%' };
    case 'bottom':
    default:
      return { bottom: THEME.spacing.lg };
  }
};

export function Toast({
  visible,
  message,
  type = 'info',
  position = 'bottom',
  duration = 3000,
  onDismiss,
  action,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const animationValue = React.useRef(new Animated.Value(0)).current;

  const styles = getToastStyles(type);
  const positionStyle = getPositionStyle(position);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(animationValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
          onDismiss?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(animationValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible, duration, animationValue, onDismiss]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styleSheet.container,
        positionStyle,
        {
          opacity: animationValue,
          transform: [
            {
              translateY: animationValue.interpolate({
                inputRange: [0, 1],
                outputRange: [position === 'top' ? -100 : 100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styleSheet.toast,
          { backgroundColor: styles.backgroundColor },
        ]}
      >
        <View style={styleSheet.content}>
          <MaterialIcons
            name={styles.icon}
            size={20}
            color={styles.iconColor}
            style={styleSheet.icon}
          />
          <Text
            style={[styleSheet.message, { color: styles.textColor }]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>
        {action && (
          <Pressable
            style={({ pressed }) => [
              styleSheet.actionButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={action.onPress}
          >
            <Text style={[styleSheet.actionText, { color: styles.textColor }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styleSheet.closeButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => {
            Animated.timing(animationValue, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              setIsVisible(false);
              onDismiss?.();
            });
          }}
        >
          <MaterialIcons
            name="close"
            size={18}
            color={styles.textColor}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styleSheet = StyleSheet.create({
  container: {
    position: 'absolute',
    left: THEME.spacing.lg,
    right: THEME.spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    ...THEME.shadows.lg,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: THEME.spacing.md,
  },
  message: {
    flex: 1,
    ...THEME.typography.body,
    fontWeight: '500',
  },
  actionButton: {
    marginLeft: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
  },
  actionText: {
    ...THEME.typography.label,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: THEME.spacing.sm,
    padding: THEME.spacing.xs,
  },
});
