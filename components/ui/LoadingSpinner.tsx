import React, { useEffect } from 'react';
import { Animated, View, StyleSheet, ViewProps } from 'react-native';
import { THEME } from '@/constants/Colors';

interface LoadingSpinnerProps extends ViewProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  color = THEME.colors.primary,
  fullScreen = false,
  style,
}: LoadingSpinnerProps) {
  const spinValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sizeMap = {
    sm: 24,
    md: 40,
    lg: 60,
  };

  const spinnerSize = sizeMap[size];

  return (
    <View
      style={[
        fullScreen && styles.fullScreen,
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: spinnerSize,
            height: spinnerSize,
            borderRadius: spinnerSize / 2,
            borderWidth: 3,
            borderColor: `${color}33`,
            borderTopColor: color,
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});
