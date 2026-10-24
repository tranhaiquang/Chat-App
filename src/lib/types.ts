/** Shared domain types for the ChatApp app. */

export type ConversationType = 'direct' | 'group';

export type AttachmentType = 'image' | 'video' | 'file';

export interface Profile {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  last_seen_at: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  avatar_url: string | null;
  direct_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_type: AttachmentType | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface TypingStatus {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  updatedAt: string;
}
