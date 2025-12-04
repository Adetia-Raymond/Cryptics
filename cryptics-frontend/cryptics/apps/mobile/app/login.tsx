import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import LoginScreen from '../src/screens/LoginScreen';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function LoginRoute() {
  const router = useRouter();

  const { user, initializing, refreshUser } = useAuth();

  const onLoginSuccess = async () => {
    // After successful auth, refresh the user in AuthContext then navigate.
    try {
      // attempt to populate AuthContext quickly so guarded routes know the user
      try {
        await refreshUser();
      } catch (e) {
        // ignore refresh failures here; navigate anyway
      }
      (router.replace as any)('/(tabs)');
    } catch (e) {
      (router.replace as any)('/');
    }
  };


  // user & initializing are used below for redirect if already logged in

  useEffect(() => {
    if (!initializing && user) {
      // already logged in, redirect to app
      router.replace('/(tabs)');
    }
  }, [user, initializing]);

  return <LoginScreen onLoginSuccess={onLoginSuccess} />;
}
