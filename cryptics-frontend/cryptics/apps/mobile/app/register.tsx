import React, { useEffect } from 'react';
import RegisterScreen from '../src/screens/RegisterScreen';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function RegisterRoute() {
  const router = useRouter();
  const { user, initializing, refreshUser } = useAuth();

  const onRegisterSuccess = async () => {
    try {
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

  useEffect(() => {
    if (!initializing && user) {
      // already logged in, redirect to app
      router.replace('/(tabs)');
    }
  }, [user, initializing]);

  return <RegisterScreen onRegisterSuccess={onRegisterSuccess} />;
}
