import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
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
      <ThemedText type="screenTitle">Student Assistant</ThemedText>
      <ThemedText type="sectionTitle" style={styles.subtitle}>
        {COPY[mode].title}
      </ThemedText>

      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="Email"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {mode !== 'forgot' && (
        <TextInput
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      )}

      <Button label={COPY[mode].cta} onPress={handleSubmit} style={styles.primaryButton} />

      <View style={styles.links}>
        {mode === 'login' && (
          <>
            <Pressable style={styles.linkTarget} onPress={() => setMode('signup')}>
              <ThemedText type="link" themeColor="textSecondary">
                No account? Sign up
              </ThemedText>
            </Pressable>
            <Pressable style={styles.linkTarget} onPress={() => setMode('forgot')}>
              <ThemedText type="link" themeColor="textSecondary">
                Forgot password?
              </ThemedText>
            </Pressable>
          </>
        )}
        {mode !== 'login' && (
          <Pressable style={styles.linkTarget} onPress={() => setMode('login')}>
            <ThemedText type="link" themeColor="textSecondary">
              Back to log in
            </ThemedText>
          </Pressable>
        )}
      </View>
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
  subtitle: {
    marginBottom: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: Spacing.two,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  linkTarget: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
  },
});
