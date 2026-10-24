import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorBanner } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, radii, spacing } from '@/theme';

export default function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter both your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPassword(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>ChatApp</Text>
        <Text style={styles.subtitle}>Welcome back. Sign in to continue.</Text>

        <View style={styles.form}>
          {error ? <ErrorBanner message={error} /> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              style={styles.input}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
          </View>

          <Button
            label="Sign in"
            onPress={handleSubmit}
            loading={isSubmitting}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Link href="/signup" asChild>
            <Text style={styles.footerLink}>Create an account</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  brand: {
    fontSize: 32,
    fontFamily: fonts.medium,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  footer: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.primary,
  },
});
