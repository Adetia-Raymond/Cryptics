import Constants from 'expo-constants';

// Prefer runtime config (Expo) then fallback to env var or localhost for development
export const API_URL =
  (Constants.manifest && (Constants.manifest as any).extra?.API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:8000';

export const MOBILE_REFRESH_STRATEGY =
  process.env.MOBILE_REFRESH_STRATEGY || 'secure_storage';
