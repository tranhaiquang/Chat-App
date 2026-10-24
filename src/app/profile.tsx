import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button, ErrorBanner } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { fetchProfiles, updateProfile } from '@/lib/chat';
import type { Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ProfileScreen() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const rows = await fetchProfiles();
        const me = rows.find((row) => row.id === user.id) ?? null;
        setProfile(me);
        setUsername(me?.username ?? '');
        setDisplayName(me?.display_name ?? '');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load your profile.',
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  async function handleSave() {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateProfile(user.id, {
        username: username.trim(),
        display_name: displayName.trim(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !user || !profile) {
    return (
      <View style={styles.centered}>
        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={handleSave} />
        </View>
      ) : null}

      <View style={styles.hero}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.username}
          size={80}
        />
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your_handle"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <Button
        label="Save changes"
        loading={isSaving}
        onPress={handleSave}
        fullWidth
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  email: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
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
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
  },
});
