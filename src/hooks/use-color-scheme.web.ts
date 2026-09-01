import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useContentState } from '@/state/content-state';

/**
 * Web-specific override (Metro/Expo resolves this file over the plain
 * use-color-scheme.ts for web builds — the platform-specific ".web." file
 * always wins) — this bug was found live: the manual theme override in
 * Settings was updating persisted state correctly, but the visible label
 * and app-wide theme never changed on web, because this file entirely
 * duplicated the pre-existing device-only logic and never read the manual
 * preference at all. Bringing it in line with use-color-scheme.ts's
 * resolution (manual override, else device setting), while preserving
 * this file's original purpose: on web, the color scheme has to be
 * re-calculated client-side after hydration to avoid a server/client
 * static-render mismatch — see the original Expo template comment below.
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const device = useRNColorScheme();
  const { themePreference } = useContentState();

  if (themePreference === 'light' || themePreference === 'dark') return themePreference;
  if (!hasHydrated) return 'light';
  return device === 'dark' ? 'dark' : 'light';
}
