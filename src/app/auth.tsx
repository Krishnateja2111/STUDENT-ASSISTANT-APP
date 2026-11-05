import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';

type Step = 'email' | 'code';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Real, passwordless sign-in: an email code, not a password. Supabase's OTP
 * flow doesn't distinguish "sign up" from "log in" — a new email creates
 * the account, an existing one just signs in, same two steps either way —
 * so this screen doesn't either, unlike the old login/signup/forgot mock.
 * There's no password to reset, which is the whole point: that was the
 * actual problem with the previous flow, not something this works around.
 */
export default function AuthScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const theme = useTheme();
  const { sendLoginCode, verifyLoginCode } = useAppState();

  const emailValid = isValidEmail(email);
  const codeValid = code.trim().length > 0;
  const showEmailError = attemptedSubmit && !emailValid;
  const showCodeError = attemptedSubmit && !codeValid;

  const handleSendCode = async () => {
    setAttemptedSubmit(true);
    setErrorMessage(null);
    if (!emailValid) return;
    setSubmitting(true);
    const error = await sendLoginCode(email.trim());
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setStep('code');
    setAttemptedSubmit(false);
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    const error = await sendLoginCode(email.trim());
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setResent(true);
  };

  const handleVerify = async () => {
    setAttemptedSubmit(true);
    setErrorMessage(null);
    if (!codeValid) return;
    setSubmitting(true);
    const error = await verifyLoginCode(email.trim(), code.trim());
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    router.replace('/(tabs)/dashboard');
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setAttemptedSubmit(false);
    setErrorMessage(null);
    setResent(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="screenTitle">Student Assistant</ThemedText>

      {step === 'email' ? (
        <>
          <ThemedText type="sectionTitle" style={styles.subtitle}>
            Sign in
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
            No password — we&apos;ll email you a one-time code instead.
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              { color: theme.text, borderColor: showEmailError ? StatusColors.danger : theme.border, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Email"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoFocus
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {showEmailError && (
            <ThemedText type="small" style={styles.errorText}>
              Enter a valid email address.
            </ThemedText>
          )}

          <Button
            label={submitting ? 'Sending code…' : 'Send code'}
            onPress={handleSendCode}
            disabled={submitting}
            style={styles.primaryButton}
          />
        </>
      ) : (
        <>
          <ThemedText type="sectionTitle" style={styles.subtitle}>
            Enter your code
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
            We sent a code to {email}.
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              { color: theme.text, borderColor: showCodeError ? StatusColors.danger : theme.border, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Code from your email"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoFocus
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          {showCodeError && (
            <ThemedText type="small" style={styles.errorText}>
              Enter the code from your email.
            </ThemedText>
          )}

          <Button
            label={submitting ? 'Verifying…' : 'Verify and sign in'}
            onPress={handleVerify}
            disabled={submitting}
            style={styles.primaryButton}
          />

          {resent && (
            <ThemedText type="small" themeColor="textMuted" style={styles.helperText}>
              Code resent — check your email.
            </ThemedText>
          )}
        </>
      )}

      {errorMessage && (
        <ThemedText type="small" style={styles.errorText}>
          {errorMessage}
        </ThemedText>
      )}

      <View style={styles.links}>
        {step === 'email' ? (
          <View />
        ) : (
          <>
            <Pressable style={styles.linkTarget} onPress={changeEmail}>
              <ThemedText type="link" themeColor="textSecondary">
                Use a different email
              </ThemedText>
            </Pressable>
            <Pressable style={styles.linkTarget} onPress={handleResend} disabled={submitting}>
              <ThemedText type="link" themeColor="textSecondary">
                Resend code
              </ThemedText>
            </Pressable>
          </>
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
    marginBottom: -Spacing.one,
  },
  helperText: {
    marginBottom: Spacing.one,
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
