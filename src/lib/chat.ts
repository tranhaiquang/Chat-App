import { supabase } from './supabase';

import type {
  Conversation,
  ConversationMember,
  Message,
  Profile,
} from './types';

/** Shape returned by the `conversation_with_meta` view helper below. */
export interface ConversationSummary {
  conversation: Conversation;
  members: ConversationMember[];
  profiles: Profile[];
  lastMessage: Message | null;
  unreadCount: number;
}

/**
 * Loads every conversation the signed-in user belongs to, along with the
 * members, the profiles needed to render names/avatars, and the newest
 * message. One round trip per table keeps this simple and fast enough for
 * a first release.
 */
export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, last_read_at, role, joined_at, user_id')
    .eq('user_id', userId);

  if (memberError) throw memberError;
  if (!memberRows?.length) return [];

  const conversationIds = memberRows.map((row) => row.conversation_id);

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds);

  if (convError) throw convError;

  // Profiles for every member of every conversation the user is in.
  const { data: allMembers, error: membersError } = await supabase
    .from('conversation_members')
    .select('*')
    .in('conversation_id', conversationIds);

  if (membersError) throw membersError;

  const allMemberIds = [...new Set(allMembers?.map((m) => m.user_id) ?? [])];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', allMemberIds);

  if (profilesError) throw profilesError;

  // Newest message per conversation. `in()` over all conversation ids is fine
  // at this scale; a proper paginated "latest N" query can replace it later.
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(500);

  if (messagesError) throw messagesError;

  const lastMessageByConversation = new Map<string, Message>();
  const unreadByConversation = new Map<string, number>();

  for (const message of messages ?? []) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message);
    }
  }

  // Unread = messages newer than my last_read_at, excluding my own.
  for (const message of messages ?? []) {
    if (message.sender_id === userId) continue;
    const myMembership = memberRows.find(
      (row) => row.conversation_id === message.conversation_id,
    );
    if (!myMembership) continue;
    if (message.created_at > myMembership.last_read_at) {
      unreadByConversation.set(
        message.conversation_id,
        (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
      );
    }
  }

  const summaries: ConversationSummary[] = (conversations ?? [])
    .map((conversation) => ({
      conversation,
      members: (allMembers ?? []).filter(
        (member) => member.conversation_id === conversation.id,
      ),
      profiles: profiles ?? [],
      lastMessage: lastMessageByConversation.get(conversation.id) ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }))
    .sort((a, b) => {
      const aTime = a.lastMessage?.created_at ?? a.conversation.created_at;
      const bTime = b.lastMessage?.created_at ?? b.conversation.created_at;
      return bTime.localeCompare(aTime);
    });

  return summaries;
}

/** Loads a page of messages for one conversation, oldest-first. */
export async function fetchMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
): Promise<Message[]> {
  const { limit = 50, before } = options;

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  // We queried newest-first for pagination; flip to chronological for display.
  return (data ?? []).reverse();
}

/** Sends a text message. */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message body is empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Sends a message with an attachment already uploaded to Supabase Storage. */
export async function sendAttachmentMessage(
  conversationId: string,
  senderId: string,
  attachment: {
    type: 'image' | 'video' | 'file';
    url: string;
    name?: string | null;
    size?: number | null;
  },
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: null,
      attachment_type: attachment.type,
      attachment_url: attachment.url,
      attachment_name: attachment.name ?? null,
      attachment_size: attachment.size ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Opens (or reuses) the 1-on-1 conversation with another user. */
export async function getOrCreateDirectConversation(
  otherUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    other_user_id: otherUserId,
  });

  if (error) throw error;
  return data as string;
}

/** Creates a group conversation and returns its id. */
export async function createGroupConversation(
  title: string,
  memberIds: string[],
): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_conversation', {
    group_title: title,
    member_ids: memberIds,
  });

  if (error) throw error;
  return data as string;
}

/** Marks every message in the conversation as read by the current user. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    conv_id: conversationId,
  });
  if (error) throw error;
}

/** Sets or clears the current user's typing indicator. */
export async function setTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('typing_status')
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    );

  if (error) throw error;
}

/** Loads profiles for building the "new chat" contact picker. */
export async function fetchProfiles(excludeUserId?: string): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('username');
  if (excludeUserId) query = query.neq('id', excludeUserId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Updates the signed-in user's profile fields. */
export async function updateProfile(
  userId: string,
  changes: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'username'>>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId);
  if (error) throw error;
}
