import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';

type Mode = 'login' | 'signup' | 'forgot';

const COPY: Record<Mode, { title: string; cta: string }> = {
  login: { title: 'Welcome back', cta: 'Log in' },
  signup: { title: 'Create your account', cta: 'Sign up' },
  forgot: { title: 'Reset your password', cta: 'Send reset link' },
};

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = useTheme();
  const { login } = useAppState();

  // TODO(auth): wire to real auth provider once the backend is picked;
  // this just flips a mock in-memory flag.
  const handleSubmit = () => {
    login();
    router.replace('/(tabs)/dashboard');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Student Assistant
      </ThemedText>
      <ThemedText type="subtitle" style={styles.subtitle}>
        {COPY[mode].title}
      </ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {mode !== 'forgot' && (
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      )}

      <Pressable style={styles.primaryButton} onPress={handleSubmit}>
        <ThemedText type="default" style={styles.primaryButtonText}>
          {COPY[mode].cta}
        </ThemedText>
      </Pressable>

      <ThemedView style={styles.links}>
        {mode === 'login' && (
          <>
            <Pressable onPress={() => setMode('signup')}>
              <ThemedText type="link" themeColor="textSecondary">
                No account? Sign up
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setMode('forgot')}>
              <ThemedText type="link" themeColor="textSecondary">
                Forgot password?
              </ThemedText>
            </Pressable>
          </>
        )}
        {mode !== 'login' && (
          <Pressable onPress={() => setMode('login')}>
            <ThemedText type="link" themeColor="textSecondary">
              Back to log in
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#3C87F7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    backgroundColor: 'transparent',
  },
});
