import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { THEME } from '@/constants/Colors';
import { useTabMark } from '@/context/TabMarkContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useI18n } from '@/i18n';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const styles = StyleSheet.create({
  tabBarStyle: {
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  labelStyle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { markedTab } = useTabMark();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.gray[500],
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.OS === 'ios'
          ? { ...styles.tabBarStyle, position: 'absolute' }
          : styles.tabBarStyle,
        tabBarLabelStyle: styles.labelStyle,
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="house.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="square.and.pencil" color={color} />
              {markedTab === 'explore' && (
                <MaterialIcons name="check-circle" size={14} color="#4CAF50" style={{ position: 'absolute', right: -4, top: -4 }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reading"
        options={{
          title: t('tabs.reading'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="book.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="articles"
        options={{
          title: t('tabs.articles'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="bookmark.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="words"
        options={{
          title: t('tabs.words'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="list.bullet" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: t('tabs.practice'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="slider.horizontal.3" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: focused ? '#e8f4f8' : 'transparent',
            }}>
              <IconSymbol size={24} name="gearshape.fill" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
