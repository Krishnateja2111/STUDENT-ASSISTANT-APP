import { useColorScheme as useDeviceColorScheme } from 'react-native';

import { useContentState } from '@/state/content-state';

/**
 * Resolves the effective color scheme: the student's manual override
 * (Settings → Appearance), if set, otherwise the device's own light/dark
 * setting — the only behavior this had before the manual toggle existed.
 * Must be called from inside ContentStateProvider (i.e. anywhere in the app
 * except the root layout's own top-level theme setup — see _layout.tsx).
 */
export function useColorScheme(): 'light' | 'dark' {
  const device = useDeviceColorScheme();
  const { themePreference } = useContentState();
  if (themePreference === 'light' || themePreference === 'dark') return themePreference;
  return device === 'dark' ? 'dark' : 'light';
}
