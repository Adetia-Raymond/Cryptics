import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';

import { HapticTab } from '../../components/haptic-tab';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // if auth init finished and no user, redirect to login
    if (!initializing && !user) {
      (router.replace as any)('/login');
    }
  }, [initializing, user, router]);

  // Render the Tabs navigator but hide the visible tab bar. This keeps the
  // routing context required by nested screens while preventing the default
  // tab bar from showing (we use a custom BottomNav in the Dashboard).
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
