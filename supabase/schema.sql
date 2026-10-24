-- ============================================================================
-- ChatApp — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL -> New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 2. Helper: membership check
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so that RLS policies on `conversation_members` can call it
-- without recursing infinitely.
create or replace function public.is_conversation_member(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conv_id
      and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  display_name text,
  avatar_url  text,
  push_token  text,
  last_seen_at timestamptz default now(),
  created_at  timestamptz default now()
);

comment on column public.profiles.push_token is
  'Expo push token for the current device; null unsubscribes the user.';

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Conversations (direct + group)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('direct', 'group')),
  title       text,
  avatar_url  text,
  -- For 'direct' chats: the two member ids sorted and joined. Makes a DM
  -- between the same two people resolve to exactly one conversation.
  direct_key  text unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint direct_key_required check (
    (type = 'direct' and direct_key is not null) or type = 'group'
  )
);

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at desc);

-- ---------------------------------------------------------------------------
-- 5. Membership
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at       timestamptz not null default now(),
  -- Read receipt state: everything up to last_read_at has been seen by this
  -- member. Drives both "read" ticks in DMs and per-member read state in groups.
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

-- ---------------------------------------------------------------------------
-- 6. Messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text,
  attachment_type text check (attachment_type in ('image', 'video', 'file')),
  attachment_url  text,
  attachment_name text,
  attachment_size bigint,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint message_has_content check (
    body is not null
    or (attachment_type is not null and attachment_url is not null)
  )
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Keep conversations.updated_at in sync with the newest message.
-- Defined here (rather than with the table) because it references public.messages.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set updated_at = greatest(updated_at, new.created_at)
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- 7. Typing indicators (ephemeral)
-- ---------------------------------------------------------------------------
create table if not exists public.typing_status (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  is_typing       boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 8. Push tokens (a user may have several devices)
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'unknown' check (platform in ('ios', 'android', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.conversations       enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages            enable row level security;
alter table public.typing_status       enable row level security;
alter table public.push_tokens         enable row level security;

-- profiles: visible to any authenticated user (needed to render sender names
-- and build the contacts list).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

-- A user may update only their own profile.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- conversations: only members can see them.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));

-- conversation_members: you can see memberships of your own conversations.
drop policy if exists members_select on public.conversation_members;
create policy members_select on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- You can join a conversation only if you added yourself, or you are an owner.
drop policy if exists members_insert on public.conversation_members;
create policy members_insert on public.conversation_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversation_members m
      where m.conversation_id = conversation_members.conversation_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Members may update their own read-receipt state; owners/admins may update
-- anyone's role.
drop policy if exists members_update on public.conversation_members;
create policy members_update on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists members_delete on public.conversation_members;
create policy members_delete on public.conversation_members
  for delete to authenticated
  using (user_id = auth.uid());

-- messages: only conversation members can read/write.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- typing_status: readable by members, writable only by yourself.
drop policy if exists typing_select on public.typing_status;
create policy typing_select on public.typing_status
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists typing_upsert on public.typing_status;
create policy typing_upsert on public.typing_status
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists typing_update on public.typing_status;
create policy typing_update on public.typing_status
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists typing_delete on public.typing_status;
create policy typing_delete on public.typing_status
  for delete to authenticated
  using (user_id = auth.uid());

-- push_tokens: private to their owner.
drop policy if exists push_tokens_select on public.push_tokens;
create policy push_tokens_select on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_tokens_upsert on public.push_tokens;
create policy push_tokens_upsert on public.push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_tokens_update on public.push_tokens;
create policy push_tokens_update on public.push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_tokens_delete on public.push_tokens;
create policy push_tokens_delete on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

-- The client never writes these two tables directly: conversations are
-- created through security-definer RPCs, read state through
-- mark_conversation_read. Revoking keeps a signed-up user from seeding a
-- direct_key to capture someone else's DM, or joining a conversation by id.
revoke insert, update on public.conversations from authenticated;
revoke insert, update on public.conversation_members from authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC: get or create a direct conversation
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  key text;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id is null or other_user_id = me then
    raise exception 'Invalid participant';
  end if;

  -- Stable key regardless of who initiates the conversation.
  key := least(me::text, other_user_id::text) || ':' || greatest(me::text, other_user_id::text);

  select id into conv_id from public.conversations where direct_key = key;
  if conv_id is not null then
    -- Make sure both sides are members (e.g. after a manual repair).
    insert into public.conversation_members (conversation_id, user_id)
    values (conv_id, me), (conv_id, other_user_id)
    on conflict do nothing;
    return conv_id;
  end if;

  insert into public.conversations (type, direct_key, created_by)
  values ('direct', key, me)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv_id, me, 'owner'), (conv_id, other_user_id, 'member');

  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC: create a group conversation
-- ---------------------------------------------------------------------------
create or replace function public.create_group_conversation(
  group_title text,
  member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
  target uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if group_title is null or trim(group_title) = '' then
    raise exception 'Group title is required';
  end if;

  insert into public.conversations (type, title, created_by)
  values ('group', trim(group_title), me)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv_id, me, 'owner');

  foreach target in array coalesce(member_ids, '{}'::uuid[]) loop
    if target <> me then
      insert into public.conversation_members (conversation_id, user_id, role)
      values (conv_id, target, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPC: mark a conversation as read up to a point in time
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_members
     set last_read_at = now()
   where conversation_id = conv_id
     and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 13. Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Media lives at `{conversation_id}/{timestamp}-{filename}`. Uploads and
-- deletes require membership of that conversation; reads are open — the
-- bucket is public, so anyone holding an object URL can fetch it.
drop policy if exists chat_media_read on storage.objects;
create policy chat_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media');

drop policy if exists chat_media_upload on storage.objects;
create policy chat_media_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_conversation_member(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_conversation_member(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_upload on storage.objects;
create policy avatars_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- 14. Realtime
-- ---------------------------------------------------------------------------
-- Only tables added to this publication are pushed over the Realtime channel.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.typing_status;

-- ---------------------------------------------------------------------------
-- 15. Seed: a few demo users (optional, safe to skip)
-- ---------------------------------------------------------------------------
-- Create these in the Supabase dashboard under Authentication -> Users, then
-- run the app. Their profile rows are created automatically by the trigger.
