import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncDailySummary, syncDeadlineReminders } from '@/lib/notifications';
import { AppStateProvider, loadInitialSession, loadPersistedAppState, useAppState, type PersistedAppState } from '@/state/app-state';
import { ContentStateProvider, loadPersistedContentState, useContentState, type PersistedContentState } from '@/state/content-state';

SplashScreen.preventAutoHideAsync();

/**
 * Keeps scheduled notifications in sync with real app state — no UI of its
 * own. Re-syncs (cancel everything this feature previously scheduled,
 * reschedule fresh) whenever a task is added, edited, completed, or deleted,
 * the schedule changes, either preference is toggled, or the app comes back
 * to the foreground (catches "a new day started while the app sat in the
 * background," which no state change alone would trigger). Needs both
 * providers already mounted (tasks/scheduledBlocks live in AppState, the
 * preferences in ContentState), so it renders alongside ThemedNavigator
 * rather than above it.
 */
function NotificationSync() {
  const { tasks, scheduledBlocks } = useAppState();
  const { notificationPrefs } = useContentState();

  useEffect(() => {
    const sync = () => {
      syncDeadlineReminders(tasks, notificationPrefs.deadlineReminders);
      syncDailySummary(scheduledBlocks, notificationPrefs.dailyPlanSummary);
    };
    sync();
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [tasks, scheduledBlocks, notificationPrefs.deadlineReminders, notificationPrefs.dailyPlanSummary]);

  return null;
}

/**
 * Reads the effective color scheme (device setting, or the student's manual
 * override from the Appearance page — see hooks/use-color-scheme.ts) and
 * applies it to React Navigation's own chrome (headers, the tab bar). Split
 * out from RootLayout because this needs ContentStateProvider to already be
 * mounted (the manual override lives there) — the navigator itself has to
 * be inside that provider tree, unlike before the manual toggle existed,
 * when the device's setting alone was read at the very top.
 */
function ThemedNavigator() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="task-entry"
          options={{ presentation: 'modal', headerShown: true, title: 'New Task' }}
        />
        <Stack.Screen
          name="reschedule"
          options={{ presentation: 'modal', headerShown: true, title: 'Schedule Update' }}
        />
        <Stack.Screen
          name="recovery/[id]"
          options={{ presentation: 'modal', headerShown: true, title: 'What Happened?' }}
        />
        <Stack.Screen
          name="course-entry"
          options={{ presentation: 'modal', headerShown: true, title: 'Course' }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', headerShown: true, title: 'Settings' }}
        />
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'modal', headerShown: true, title: 'Notifications' }}
        />
        <Stack.Screen name="course/[id]" options={{ headerShown: true, title: 'Course' }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: true, title: 'Task' }} />
        <Stack.Screen name="document/[id]" options={{ headerShown: true, title: 'Document' }} />
        <Stack.Screen name="weekly-progress" options={{ headerShown: true, title: 'Weekly Progress' }} />
        <Stack.Screen
          name="about"
          options={{ presentation: 'modal', headerShown: true, title: 'About' }}
        />
        <Stack.Screen
          name="appearance"
          options={{ presentation: 'modal', headerShown: true, title: 'Appearance' }}
        />
        <Stack.Screen
          name="availability"
          options={{ presentation: 'modal', headerShown: true, title: 'Study Availability' }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Both persisted slices are loaded in parallel, once, before either
  // provider mounts — this is the hydration gate. The native splash screen
  // (already held by preventAutoHideAsync above) stays up the entire time,
  // so there's nothing new to build for a loading state: returning null
  // here just means "still under the splash," never a blank/incorrect
  // pre-hydration frame.
  const [ready, setReady] = useState(false);
  const [appStateInitial, setAppStateInitial] = useState<PersistedAppState | null>(null);
  const [contentStateInitial, setContentStateInitial] = useState<PersistedContentState | null>(null);
  // Resolved alongside the two local-storage loads below — without this,
  // index.tsx's isAuthed-based redirect would fire against the default
  // "not logged in" state and flash the auth screen even for an
  // already-signed-in user, before the real session finished loading.
  const [isAuthedInitial, setIsAuthedInitial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPersistedAppState(), loadPersistedContentState(), loadInitialSession()]).then(
      ([appData, contentData, authed]) => {
        if (cancelled) return;
        setAppStateInitial(appData);
        setContentStateInitial(contentData);
        setIsAuthedInitial(authed);
        setReady(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider initialData={appStateInitial} initialIsAuthed={isAuthedInitial}>
          <ContentStateProvider initialData={contentStateInitial}>
            <NotificationSync />
            <ThemedNavigator />
          </ContentStateProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
