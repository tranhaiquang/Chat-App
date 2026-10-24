import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

type Handler = (payload: any) => void;

interface Handlers {
  onInsert?: Handler;
  onUpdate?: Handler;
  onDelete?: Handler;
}

/**
 * Keeps the latest handlers in a ref so a re-render doesn't tear down and
 * recreate the Realtime subscription. The ref is updated in an effect rather
 * than during render, which the React Compiler rules require.
 */
function useLatestHandlers(handlers: Handlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  return handlersRef;
}

/**
 * Subscribes to Supabase Realtime changes on the `messages` table and
 * dispatches row events to the supplied handlers. The channel is torn down
 * automatically on unmount.
 */
export function useRealtimeSubscription(
  topic: string,
  handlers: Handlers,
  enabled = true,
) {
  const handlersRef = useLatestHandlers(handlers);

  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => handlersRef.current.onInsert?.(payload),
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => handlersRef.current.onUpdate?.(payload),
    );

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages' },
      (payload) => handlersRef.current.onDelete?.(payload),
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topic, enabled, handlersRef]);
}

/**
 * Subscribes to INSERT/UPDATE/DELETE rows of a table, filtered to a single
 * conversation. Used for typing indicators and membership changes.
 */
export function useConversationChannel(
  conversationId: string | null,
  table: 'typing_status' | 'conversation_members',
  handlers: Handlers,
  enabled = true,
) {
  const handlersRef = useLatestHandlers(handlers);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    const channel = supabase.channel(`conversation:${conversationId}`);

    const base = {
      schema: 'public',
      table,
      filter: `conversation_id=eq.${conversationId}`,
    };

    channel.on(
      'postgres_changes',
      { ...base, event: 'INSERT' },
      (payload) => handlersRef.current.onInsert?.(payload),
    );
    channel.on(
      'postgres_changes',
      { ...base, event: 'UPDATE' },
      (payload) => handlersRef.current.onUpdate?.(payload),
    );
    channel.on(
      'postgres_changes',
      { ...base, event: 'DELETE' },
      (payload) => handlersRef.current.onDelete?.(payload),
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, table, enabled, handlersRef]);
}
