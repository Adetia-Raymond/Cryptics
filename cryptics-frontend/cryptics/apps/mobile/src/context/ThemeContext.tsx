import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from '../../hooks/use-color-scheme';

export type ThemePref = 'system' | 'light' | 'dark';

type ThemeContextType = {
  preference: ThemePref;
  setPreference: (p: ThemePref) => void;
  effective: 'light' | 'dark';
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProviderLocal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme() ?? 'light';
  const [preference, setPreference] = useState<ThemePref>('system');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('theme_pref');
      if (raw === 'light' || raw === 'dark' || raw === 'system') setPreference(raw as ThemePref);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('theme_pref', preference);
    } catch (e) {
      // ignore
    }
  }, [preference]);

  const effective = useMemo(() => (preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference), [preference, system]);

  const setPref = (p: ThemePref) => setPreference(p);
  const toggle = () => setPreference((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ preference, setPreference: setPref, effective, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useThemePref() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePref must be used within ThemeProviderLocal');
  return ctx;
}
