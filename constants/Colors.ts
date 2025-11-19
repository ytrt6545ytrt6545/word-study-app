/**
 * Unified Design System
 * Consistent colors, typography, and spacing for the entire app
 */

// Primary color palette
const PRIMARY_BLUE = '#0a7ea4';
const PRIMARY_LIGHT = '#e8f4f8';

// Semantic colors for different features
const FEATURE_COLORS = {
  tags: '#2196F3',      // Blue for tags
  review: '#4CAF50',    // Green for review
  exam: '#FF9800',      // Orange for exam
  listening: '#8B5CF6', // Purple for listening
  reading: '#E91E63',   // Pink for reading
  articles: '#009688',  // Teal for articles
  practice: '#3F51B5',  // Indigo for practice
};

// Neutral grays
const GRAYS = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

// Semantic colors
const SEMANTIC = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

const tintColorLight = PRIMARY_BLUE;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: GRAYS[900],
    background: '#fff',
    tint: tintColorLight,
    icon: GRAYS[500],
    tabIconDefault: GRAYS[500],
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Design tokens
export const THEME = {
  colors: {
    primary: PRIMARY_BLUE,
    primaryLight: PRIMARY_LIGHT,
    feature: FEATURE_COLORS,
    semantic: SEMANTIC,
    gray: GRAYS,
    surface: '#fff',
    surfaceAlt: '#f8fafc',
    border: GRAYS[200],
    divider: GRAYS[100],
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 26,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 22,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 15,
      fontWeight: '500' as const,
      lineHeight: 20,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 16,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 14,
    },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};
