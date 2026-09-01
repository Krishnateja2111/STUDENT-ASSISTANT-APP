import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider, loadPersistedAppState, type PersistedAppState } from '@/state/app-state';
import { ContentStateProvider, loadPersistedContentState, type PersistedContentState } from '@/state/content-state';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Both persisted slices are loaded in parallel, once, before either
  // provider mounts — this is the hydration gate. The native splash screen
  // (already held by preventAutoHideAsync above) stays up the entire time,
  // so there's nothing new to build for a loading state: returning null
  // here just means "still under the splash," never a blank/incorrect
  // pre-hydration frame.
  const [ready, setReady] = useState(false);
  const [appStateInitial, setAppStateInitial] = useState<PersistedAppState | null>(null);
  const [contentStateInitial, setContentStateInitial] = useState<PersistedContentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPersistedAppState(), loadPersistedContentState()]).then(([appData, contentData]) => {
      if (cancelled) return;
      setAppStateInitial(appData);
      setContentStateInitial(contentData);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppStateProvider initialData={appStateInitial}>
          <ContentStateProvider initialData={contentStateInitial}>
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
            </Stack>
          </ContentStateProvider>
        </AppStateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
