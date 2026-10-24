import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { MessageBubble } from '@/components/MessageBubble';
import { ErrorBanner } from '@/components/Button';
import { pickDocument, pickMedia } from '@/components/AttachmentPicker';
import type { PickedAttachment } from '@/components/AttachmentPicker';
import { useAuth } from '@/context/AuthContext';
import { useConversationChannel, useRealtimeSubscription } from '@/hooks/useRealtime';
import {
  fetchMessages,
  markConversationRead,
  sendAttachmentMessage,
  sendTextMessage,
  setTypingStatus,
} from '@/lib/chat';
import { supabase } from '@/lib/supabase';
import { uploadAttachment } from '@/lib/storage';
import type { ConversationMember, Message, Profile } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conversation, setConversation] = useState<{
    id: string;
    type: 'direct' | 'group';
    title: string | null;
  } | null>(null);

  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSignal = useRef<boolean>(false);

  // ---------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!conversationId || !user) return;
    setError(null);

    try {
      const [loadedMessages, memberRows, conversationRow] = await Promise.all([
        fetchMessages(conversationId),
        supabase
          .from('conversation_members')
          .select('*')
          .eq('conversation_id', conversationId),
        supabase
          .from('conversations')
          .select('id, type, title')
          .eq('id', conversationId)
          .single(),
      ]);

      setMessages(loadedMessages);
      setMembers(memberRows.data ?? []);

      const memberIds = (memberRows.data ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('*')
          .in('id', memberIds);
        setProfiles(profileRows ?? []);
      }

      if (conversationRow.data) {
        setConversation(conversationRow.data as typeof conversation);
      }

      await markConversationRead(conversationId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load this conversation.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user) return;

    // Fetch inside the effect so the state updates land in the promise
    // callbacks rather than synchronously in the effect body.
    let cancelled = false;

    (async () => {
      try {
        const [loadedMessages, memberRows, conversationRow] = await Promise.all([
          fetchMessages(conversationId),
          supabase
            .from('conversation_members')
            .select('*')
            .eq('conversation_id', conversationId),
          supabase
            .from('conversations')
            .select('id, type, title')
            .eq('id', conversationId)
            .single(),
        ]);

        if (cancelled) return;

        setMessages(loadedMessages);
        setMembers(memberRows.data ?? []);

        const memberIds = (memberRows.data ?? []).map((m) => m.user_id);
        if (memberIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('*')
            .in('id', memberIds);
          if (!cancelled) setProfiles(profileRows ?? []);
        }

        if (conversationRow.data && !cancelled) {
          setConversation(conversationRow.data as typeof conversation);
        }

        await markConversationRead(conversationId);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load this conversation.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, user]);

  // ---------------------------------------------------------------------
  // Realtime: incoming messages
  // ---------------------------------------------------------------------
  useRealtimeSubscription(
    `messages:${conversationId}`,
    {
      onInsert: (payload: { new: Message }) => {
        const incoming = payload.new;
        if (incoming.conversation_id !== conversationId) return;

        setMessages((current) => {
          // Ignore a message we already have (the sender also receives it).
          if (current.some((m) => m.id === incoming.id)) return current;
          return [...current, incoming];
        });

        if (incoming.sender_id !== user?.id) {
          markConversationRead(conversationId).catch(() => {});
        }
      },
    },
    Boolean(conversationId && user),
  );

  // ---------------------------------------------------------------------
  // Realtime: typing indicators
  // ---------------------------------------------------------------------
  useConversationChannel(
    conversationId ?? null,
    'typing_status',
    {
      onInsert: (payload: { new: { user_id: string; is_typing: boolean } }) =>
        applyTyping(payload.new.user_id, payload.new.is_typing),
      onUpdate: (payload: { new: { user_id: string; is_typing: boolean } }) =>
        applyTyping(payload.new.user_id, payload.new.is_typing),
      onDelete: (payload: { old: { user_id: string } }) =>
        applyTyping(payload.old.user_id, false),
    },
    Boolean(conversationId && user),
  );

  function applyTyping(userId: string, isTyping: boolean) {
    if (!userId || userId === user?.id) return;

    setTypingUserIds((current) => {
      if (isTyping) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
  }

  // Typing indicators expire on their own if no "stopped typing" arrives.
  useEffect(() => {
    if (typingUserIds.length === 0) return;
    const timer = setTimeout(() => {
      setTypingUserIds([]);
    }, 5000);
    return () => clearTimeout(timer);
  }, [typingUserIds]);

  // ---------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------
  const title = useMemo(() => {
    if (!conversation) return 'Chat';
    if (conversation.type === 'group') return conversation.title ?? 'Group chat';

    const other = members.find((m) => m.user_id !== user?.id);
    if (!other) return 'Direct message';
    const profile = profiles.find((p) => p.id === other.user_id);
    return profile ? displayName(profile) : 'Direct message';
  }, [conversation, members, profiles, user?.id]);

  const typingText = useMemo(() => {
    if (typingUserIds.length === 0) return null;
    if (typingUserIds.length === 1) {
      const profile = profiles.find((p) => p.id === typingUserIds[0]);
      const name = profile ? displayName(profile) : 'Someone';
      return `${name} is typing…`;
    }
    return 'Several people are typing…';
  }, [typingUserIds, profiles]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  async function handleSend() {
    const body = draft.trim();
    if (!body || !user || !conversationId || isSending) return;

    setDraft('');
    setIsSending(true);
    signalTyping(false);

    try {
      const sent = await sendTextMessage(conversationId, user.id, body);
      setMessages((current) =>
        current.some((m) => m.id === sent.id) ? current : [...current, sent],
      );
    } catch (err) {
      setDraft(body);
      Alert.alert(
        'Message not sent',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setIsSending(false);
    }
  }

  function signalTyping(isTyping: boolean) {
    if (!conversationId || !user) return;
    if (lastTypingSignal.current === isTyping) return;
    lastTypingSignal.current = isTyping;

    setTypingStatus(conversationId, user.id, isTyping).catch(() => {});
  }

  async function handleAttachment(picker: () => Promise<PickedAttachment | null>) {
    if (!conversationId || !user) return;
    try {
      const picked = await picker();
      if (!picked) return;
      if (isUploading) return;

      setIsUploading(true);
      try {
        const uploaded = await uploadAttachment(
          conversationId,
          picked.localUri,
          picked.fileName,
          picked.mimeType,
        );

        const sent = await sendAttachmentMessage(conversationId, user.id, uploaded);
        setMessages((current) =>
          current.some((m) => m.id === sent.id) ? current : [...current, sent],
        );
        await markConversationRead(conversationId);
      } finally {
        setIsUploading(false);
      }
    } catch (err) {
      Alert.alert('Could not attach this file', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  function handleChangeText(value: string) {
    setDraft(value);
    signalTyping(value.length > 0);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      signalTyping(false);
    }, 2500);
  }

  // Stop typing when the screen goes away.
  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      signalTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  // Mark read whenever the screen regains focus.
  useEffect(() => {
    if (!conversationId) return;
    const subscription = supabase
      .channel(`focus:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_members',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {},
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>

        <Avatar
          uri={
            conversation?.type === 'group'
              ? null
              : profiles.find((p) => p.id !== user?.id)?.avatar_url ?? null
          }
          name={title}
          size={38}
        />

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {typingText ? (
            <Text style={styles.headerTyping}>{typingText}</Text>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      ) : null}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === user?.id;
            const previous = messages[index - 1];

            // Show the sender name only when the previous message is from
            // someone else (i.e. at the start of a run of messages).
            const showSenderName =
              !isMine &&
              conversation?.type === 'group' &&
              (!previous || previous.sender_id !== item.sender_id);

            const senderProfile = profiles.find((p) => p.id === item.sender_id);

            // Double tick only when someone has read up to *this* message.
            const readByOthers =
              isMine &&
              members.some(
                (m) => m.user_id !== user?.id && m.last_read_at >= item.created_at,
              );

            return (
              <MessageBubble
                message={item}
                isMine={isMine}
                senderName={senderProfile ? displayName(senderProfile) : 'Unknown'}
                showSenderName={showSenderName}
                readByOthers={readByOthers}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Say hello to get things started.
              </Text>
            </View>
          }
        />

        {/* Composer */}
        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach photo or video"
            disabled={isUploading}
            onPress={() => handleAttachment(pickMedia)}
            style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
            )}
          </Pressable>

          <TextInput
            value={draft}
            onChangeText={handleChangeText}
            placeholder="Message"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            multiline
            maxLength={4000}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach a file"
            disabled={isUploading}
            onPress={() => handleAttachment(pickDocument)}
            style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
          >
            <Ionicons name="attach-outline" size={24} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={draft.trim().length === 0 || isSending}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              draft.trim().length === 0 && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="send" size={20} color={colors.textInverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  headerTyping: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.primary,
    marginTop: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.lg,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 130,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  attachButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
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
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
