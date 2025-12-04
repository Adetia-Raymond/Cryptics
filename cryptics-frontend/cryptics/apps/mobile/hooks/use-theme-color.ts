/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePref } from '../src/context/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const systemTheme = useColorScheme() ?? 'light';
  let theme = systemTheme;
  try {
    const pref = useThemePref();
    theme = pref.effective ?? systemTheme;
  } catch (e) {
    // no provider available; fallback to system theme
    theme = systemTheme;
  }
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
