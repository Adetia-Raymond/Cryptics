import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { ToastProvider } from '../src/context/ToastContext';

import { useColorScheme } from '../hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProviderLocal, useThemePref } from '../src/context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();

  if (initializing) {
    // Render a full-screen translucent overlay to block navigation until auth init completes
    return (
      <View style={styles.overlayContainer}>
        <View style={styles.overlay} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  // If not authenticated, show the login route; otherwise show app stack
  if (!user) {
    return (
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProviderLocal>
        <InnerApp />
      </ThemeProviderLocal>
    </AuthProvider>
  );
}

function InnerApp() {
  const { effective } = useThemePref();
  const navTheme = effective === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={navTheme}>
      <ToastProvider>
        <AuthGate>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <DebugBanner />
          <StatusBar style="auto" />
        </AuthGate>
      </ToastProvider>
    </ThemeProvider>
  );
}

function DebugBanner() {
  const { lastRefreshAt, lastRefreshError } = useAuth();
  if (!lastRefreshAt && !lastRefreshError) return null;
  return (
    <View style={{ position: 'absolute', top: 44, left: 12, right: 12, zIndex: 9999 }}>
      <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>{lastRefreshError ? `Refresh error: ${lastRefreshError}` : `Last refresh: ${new Date(lastRefreshAt!).toLocaleTimeString()}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayContainer: { flex: 1, position: 'relative' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
});
