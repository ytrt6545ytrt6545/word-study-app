import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';
import { THEME } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  backgroundColor?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  style?: ViewStyle;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  backgroundColor = THEME.colors.surfaceAlt,
  showBackButton = false,
  onBackPress,
  rightComponent,
  style,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.header,
        { backgroundColor },
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          {showBackButton && (
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleBackPress}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={THEME.colors.gray[900]}
              />
            </Pressable>
          )}

          <View style={styles.titleContainer}>
            {icon && (
              <Text style={styles.icon}>{icon}</Text>
            )}
            <Text style={styles.title}>{title}</Text>
          </View>

          {rightComponent && (
            <View style={styles.rightComponent}>
              {rightComponent}
            </View>
          )}
        </View>

        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  content: {
    gap: THEME.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  backButton: {
    padding: THEME.spacing.sm,
    marginLeft: -THEME.spacing.sm,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    ...THEME.typography.h2,
    color: THEME.colors.gray[900],
    flex: 1,
  },
  rightComponent: {
    marginLeft: 'auto',
  },
  subtitle: {
    ...THEME.typography.body,
    color: THEME.colors.gray[500],
    marginLeft: THEME.spacing.lg,
  },
});
