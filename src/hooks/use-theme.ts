/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeSchemeContext } from '@/context/theme-scheme-context';

export function useThemeScheme() {
  return useThemeSchemeContext().scheme;
}

export function useTheme() {
  return Colors[useThemeScheme()];
}

export function useThemeToggle() {
  return useThemeSchemeContext().toggleScheme;
}
