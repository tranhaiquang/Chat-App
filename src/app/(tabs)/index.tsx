import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { fetchConversations } from '@/lib/chat';
import type { ConversationSummary } from '@/lib/chat';
import type { Message, Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ChatsScreen() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const next = await fetchConversations(user.id);
      setSummaries(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load your conversations.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Fetch inside the effect so state updates land in the promise callback
    // rather than synchronously in the effect body.
    let cancelled = false;

    (async () => {
      try {
        const next = await fetchConversations(user.id);
        if (!cancelled) setSummaries(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load your conversations.',
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

  // A new message anywhere updates the preview line in the list.
  useRealtimeSubscription(
    'messages-global',
    {
      onInsert: (payload: { new: Message }) => {
        setSummaries((current) =>
          current.map((summary) => {
            if (summary.conversation.id !== payload.new.conversation_id) {
              return summary;
            }
            const isMine = payload.new.sender_id === user?.id;
            return {
              ...summary,
              lastMessage: payload.new,
              unreadCount: isMine
                ? summary.unreadCount
                : summary.unreadCount + 1,
            };
          }),
        );
      },
    },
    Boolean(user),
  );

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

      {summaries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the button below to start chatting with someone.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/new-chat')}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
          >
            <Text style={styles.emptyButtonText}>New conversation</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={summaries}
          keyExtractor={(item) => item.conversation.id}
          renderItem={({ item }) => (
            <ConversationRow summary={item} currentUserId={user?.id ?? ''} />
          )}
        />
      )}
    </View>
  );
}

function ConversationRow({
  summary,
  currentUserId,
}: {
  summary: ConversationSummary;
  currentUserId: string;
}) {
  const { conversation, members, profiles, lastMessage, unreadCount } = summary;

  const others = useMemo(
    () => members.filter((member) => member.user_id !== currentUserId),
    [members, currentUserId],
  );

  const title = useMemo(() => {
    if (conversation.type === 'group') {
      return conversation.title ?? 'Group chat';
    }
    const other = others[0];
    if (!other) return 'Conversation';
    const profile = profiles.find((p) => p.id === other.user_id);
    return profile ? displayName(profile) : 'Direct message';
  }, [conversation, others, profiles]);

  const avatarUri = useMemo(() => {
    if (conversation.type === 'group') return conversation.avatar_url;
    const other = others[0];
    if (!other) return null;
    return profiles.find((p) => p.id === other.user_id)?.avatar_url ?? null;
  }, [conversation, others, profiles]);

  const subtitle = useMemo(() => {
    if (!lastMessage) return 'No messages yet';
    const prefix =
      lastMessage.sender_id === currentUserId ? 'You: ' : senderPrefix(lastMessage, profiles);
    if (lastMessage.attachment_type) {
      const kind =
        lastMessage.attachment_type === 'image'
          ? 'Photo'
          : lastMessage.attachment_type === 'video'
            ? 'Video'
            : 'File';
      return lastMessage.body
        ? `${prefix}${lastMessage.body}`
        : `${prefix}${kind}${lastMessage.attachment_name ? ` · ${lastMessage.attachment_name}` : ''}`;
    }
    return `${prefix}${lastMessage.body ?? ''}`;
  }, [lastMessage, currentUserId, profiles]);

  const timestamp = lastMessage ? formatTimestamp(lastMessage.created_at) : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${title}`}
      onPress={() => router.push(`/chat/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar uri={avatarUri} name={title} size={54} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.time}>{timestamp}</Text>
        </View>

        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unreadCount > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>

          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function displayName(profile: Profile): string {
  return profile.display_name?.trim() || profile.username;
}

function senderPrefix(
  message: Message,
  profiles: Profile[],
): string {
  const profile = profiles.find((p) => p.id === message.sender_id);
  return profile ? `${displayName(profile)}: ` : '';
}

/** "now", "5m", "2h", "Yesterday", or a date. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    return `${Math.floor(diffMinutes / 60)}h`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
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
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  preview: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    fontWeight: '700',
    color: colors.textInverse,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  emptyButtonText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textInverse,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
