import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button, ErrorBanner } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import {
  createGroupConversation,
  fetchProfiles,
  getOrCreateDirectConversation,
} from '@/lib/chat';
import type { Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function NewChatScreen() {
  const { user } = useAuth();
  const { target } = useLocalSearchParams<{ target?: string }>();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchProfiles(user?.id);
      setProfiles(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load contacts.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await fetchProfiles(user?.id);
        if (!cancelled) setProfiles(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load contacts.',
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

  // Deep link straight into a 1-on-1 chat when a contact was tapped.
  useEffect(() => {
    if (!target || !user) return;

    let cancelled = false;
    (async () => {
      try {
        const conversationId = await getOrCreateDirectConversation(target);
        if (!cancelled) router.replace(`/chat/${conversationId}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open the chat.');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target, user]);

  async function handleCreate() {
    if (!user) return;

    if (selected.length === 0) {
      setError('Select at least one person.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // One person -> direct chat. Two or more -> group.
      const conversationId =
        selected.length === 1
          ? await getOrCreateDirectConversation(selected[0])
          : await createGroupConversation(groupTitle.trim(), selected);

      router.replace(`/chat/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the chat.');
      setIsCreating(false);
    }
  }

  function toggleSelection(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isGroup = selected.length > 1;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      ) : null}

      {isGroup ? (
        <View style={styles.groupTitleWrap}>
          <Text style={styles.groupTitleLabel}>Group name</Text>
          <TextInput
            value={groupTitle}
            onChangeText={setGroupTitle}
            placeholder="Weekend trip"
            placeholderTextColor={colors.textTertiary}
            style={styles.groupTitleInput}
          />
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggleSelection(item.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar
                uri={item.avatar_url}
                name={displayName(item)}
                size={48}
              />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName(item)}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>

              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one to chat with yet</Text>
            <Text style={styles.emptySubtitle}>
              Ask a friend to sign up with the same Supabase project.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          label={
            isCreating
              ? 'Creating…'
              : isGroup
                ? `Create group${groupTitle.trim() ? ` · ${groupTitle.trim()}` : ''}`
                : selected.length === 1
                  ? 'Start chat'
                  : 'Select someone'
          }
          onPress={handleCreate}
          loading={isCreating}
          disabled={selected.length === 0}
          fullWidth
        />
      </View>
    </View>
  );
}

function displayName(profile: Profile): string {
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
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  groupTitleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  groupTitleLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  groupTitleInput: {
    height: 46,
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
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
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
