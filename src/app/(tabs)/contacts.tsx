import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ErrorBanner } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { fetchProfiles } from '@/lib/chat';
import type { Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ContactsScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchProfiles(user?.id);
      setProfiles(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load your contacts.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Fetch inside the effect so the state updates happen in the promise
    // callback rather than synchronously in the effect body.
    let cancelled = false;

    (async () => {
      try {
        const next = await fetchProfiles(user?.id);
        if (!cancelled) setProfiles(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load your contacts.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      ) : null}

      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtitle}>
            Once other people sign up, they&apos;ll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/new-chat?target=${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar
                uri={item.avatar_url}
                name={displayedName(item)}
                size={52}
              />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayedName(item)}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
              <View style={styles.chevronWrap}>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function displayedName(profile: {
  username: string;
  display_name?: string | null;
}): string {
  return profile.display_name?.trim() || profile.username;
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  chevronWrap: {
    width: 20,
    alignItems: 'flex-end',
  },
  chevron: {
    fontSize: 22,
    color: colors.textTertiary,
    lineHeight: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
