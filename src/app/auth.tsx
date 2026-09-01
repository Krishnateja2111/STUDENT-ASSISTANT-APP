import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';

type Mode = 'login' | 'signup' | 'forgot';

const COPY: Record<Mode, { title: string; cta: string }> = {
  login: { title: 'Welcome back', cta: 'Log in' },
  signup: { title: 'Create your account', cta: 'Sign up' },
  forgot: { title: 'Reset your password', cta: 'Send reset link' },
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const theme = useTheme();
  const { login } = useAppState();

  const switchMode = (next: Mode) => {
    setMode(next);
    setAttemptedSubmit(false);
  };

  // Real (if minimal) validation — never a fake "invalid credentials" check,
  // since there's no real account system behind this yet (see the TODO
  // below): only what can be honestly verified client-side without a
  // backend. TODO(auth): wire to a real auth provider once the backend is
  // picked; this just flips a mock in-memory flag once the fields are
  // actually filled in and well-formed.
  const emailValid = isValidEmail(email);
  const passwordValid = mode === 'forgot' || password.length > 0;
  const canSubmit = emailValid && passwordValid;
  const showEmailError = attemptedSubmit && !emailValid;
  const showPasswordError = attemptedSubmit && !passwordValid;

  const handleSubmit = () => {
    setAttemptedSubmit(true);
    if (!canSubmit) return;
    // "forgot" never claims a reset email was sent — there's no real email
    // system behind this yet (see the TODO below), and a fake success
    // message here would be exactly the kind of fabricated confirmation the
    // master spec's error-handling rules forbid. The inline note below the
    // button says so honestly instead of pretending the submit worked.
    if (mode === 'forgot') return;
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
          { color: theme.text, borderColor: showEmailError ? StatusColors.danger : theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="Email"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {showEmailError && (
        <ThemedText type="small" style={styles.errorText}>
          Enter a valid email address.
        </ThemedText>
      )}

      {mode !== 'forgot' && (
        <>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { color: theme.text, borderColor: showPasswordError ? StatusColors.danger : theme.border, backgroundColor: theme.backgroundElement },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.showPasswordButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          {showPasswordError && (
            <ThemedText type="small" style={styles.errorText}>
              Enter your password.
            </ThemedText>
          )}
        </>
      )}

      <Button label={COPY[mode].cta} onPress={handleSubmit} style={styles.primaryButton} />

      {mode === 'forgot' && (
        <ThemedText type="small" themeColor="textMuted" style={styles.forgotNote}>
          Password reset isn&apos;t connected to a real account system yet — this is a demo build.
        </ThemedText>
      )}

      <View style={styles.links}>
        {mode === 'login' && (
          <>
            <Pressable style={styles.linkTarget} onPress={() => switchMode('signup')}>
              <ThemedText type="link" themeColor="textSecondary">
                No account? Sign up
              </ThemedText>
            </Pressable>
            <Pressable style={styles.linkTarget} onPress={() => switchMode('forgot')}>
              <ThemedText type="link" themeColor="textSecondary">
                Forgot password?
              </ThemedText>
            </Pressable>
          </>
        )}
        {mode !== 'login' && (
          <Pressable style={styles.linkTarget} onPress={() => switchMode('login')}>
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
  errorText: {
    color: StatusColors.danger,
    marginTop: -Spacing.two,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  showPasswordButton: {
    position: 'absolute',
    right: Spacing.three,
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: Spacing.two,
  },
  forgotNote: {
    textAlign: 'center',
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
