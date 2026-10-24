import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function SettingsScreen() {
  const { user, signOutUser } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(data);
      setIsLoading(false);
    })();
  }, [user]);

  async function handleEnablePush() {
    if (!user) return;
    setPushStatus('Requesting permission…');

    try {
      const token = await registerForPushNotifications(user.id);
      setPushStatus(
        token
          ? 'Push notifications are on for this device.'
          : 'Could not register for push on this device.',
      );
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutUser() },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const displayName = profile?.display_name?.trim() || profile?.username || 'You';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
      >
        <Avatar uri={profile?.avatar_url} name={displayName} size={64} />
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileUsername}>@{profile?.username ?? 'unknown'}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Push notifications</Text>
        <Text style={styles.cardBody}>
          Get alerted when someone sends you a message.
        </Text>
        {pushStatus ? <Text style={styles.cardStatus}>{pushStatus}</Text> : null}
        <Button
          label="Enable push notifications"
          variant="secondary"
          onPress={handleEnablePush}
        />
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Signed in as</Text>
        <Text style={styles.cardBody}>{user?.email}</Text>
      </View>

      <Button label="Sign out" variant="ghost" onPress={handleSignOut} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 18,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  profileUsername: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textTertiary,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  cardStatus: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.primary,
  },
});
