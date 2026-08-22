import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider } from '@/state/app-state';
import { ContentStateProvider } from '@/state/content-state';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppStateProvider>
          <ContentStateProvider>
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
                name="course-entry"
                options={{ presentation: 'modal', headerShown: true, title: 'Course' }}
              />
              <Stack.Screen
                name="settings"
                options={{ presentation: 'modal', headerShown: true, title: 'Settings' }}
              />
              <Stack.Screen name="course/[id]" options={{ headerShown: true, title: 'Course' }} />
              <Stack.Screen name="document/[id]" options={{ headerShown: true, title: 'Document' }} />
            </Stack>
          </ContentStateProvider>
        </AppStateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
