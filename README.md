# ChatApp

A cross-platform chat app for Android and iOS, built with **Expo (React Native) + TypeScript** and **Supabase**.

## Features

- **Authentication** — email/password sign-up and sign-in, session persisted locally
- **1-on-1 and group chats** — direct conversations are deduplicated by a stable key, so the same two people always share one thread
- **Media sharing** — photos, videos, and documents, uploaded to Supabase Storage
- **Push notifications** — Expo push tokens registered per device; tapping a notification opens the conversation
- **Read receipts** — per-member `last_read_at`, with ✓ / ✓✓ ticks on your own messages
- **Typing indicators** — live presence per conversation, auto-expiring after 5 seconds
- **Unread badges** — per-conversation unread counts

## Stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 58, React Native 0.88, TypeScript 6 |
| Navigation | Expo Router (file-based, `src/app/`) |
| Backend | Supabase — Postgres, Auth, Realtime, Storage |
| Notifications | `expo-notifications` + Expo Push Service |

## Getting started

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Wait for the database to finish provisioning.

### 2. Apply the schema

Open **Dashboard → SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it.

The script is idempotent — re-running it is safe. It creates:

- Tables: `profiles`, `conversations`, `conversation_members`, `messages`, `typing_status`, `push_tokens`
- Row Level Security policies on every table (members-only access)
- RPC functions: `get_or_create_direct_conversation`, `create_group_conversation`, `mark_conversation_read`
- Storage buckets: `chat-media`, `avatars`
- Realtime publication entries for live updates

### 3. Configure the environment

```bash
cp .env.example .env
```

Then fill in your values from **Dashboard → Project Settings → API**:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Both values are safe to ship in the app — data access is protected by Row Level
Security, not by hiding the key. Never put the database password or the legacy
`service_role` key in the app.

### 4. Run it

```bash
npm install
npm run android     # Android device or emulator
npm run ios         # iOS simulator (macOS only)
npm run web         # browser — handy for quick testing
```

### 5. Create test users

Supabase ships with email confirmation enabled by default, which blocks the
sign-up screen from logging you straight in. For local testing either:

- **Dashboard → Authentication → Sign In / Providers → Email** → turn off
  "Confirm email", or
- create users directly under **Dashboard → Authentication → Users → Add user**
  and confirm each one by email.

Each user gets a `profiles` row automatically from the `handle_new_user` trigger.

## Push notifications

Push requires a development build — Expo Go on Android cannot receive remote
push notifications as of SDK 53.

```bash
# Android
npx expo run:android

# iOS (macOS)
npx expo run:ios
```

Push also needs an EAS project id. Run `eas init` and it is written into
`app.json` under `extra.eas.projectId`. Until then, the app runs fine and
everything except push works; the Settings tab will say the token could not be
registered.

## Project structure

```
src/
  app/                    # Expo Router routes — every file is a screen
    _layout.tsx           # Root navigator + auth provider + notification router
    index.tsx             # Entry: waits for session, redirects
    login.tsx / signup.tsx
    (tabs)/
      _layout.tsx         # Tab navigator
      index.tsx           # Conversation list
      contacts.tsx        # People directory
      settings.tsx        # Profile summary, push toggle, sign out
    chat/[id].tsx         # The chat screen
    new-chat.tsx          # Pick people → direct or group conversation
    profile.tsx           # Edit display name / username
  components/             # Avatar, Button, MessageBubble, AttachmentPicker
  context/AuthContext.tsx # Session state, shared app-wide
  hooks/useRealtime.ts    # Supabase Realtime subscriptions
  lib/
    supabase.ts           # Client + session storage adapter
    auth.ts               # Sign in / sign up / sign out
    chat.ts               # Data access: conversations, messages, typing
    storage.ts            # Attachment upload to Supabase Storage
    notifications.ts      # Push token registration + response listener
    types.ts              # Shared domain types
  theme.ts                # Colors, spacing, radii, typography
supabase/schema.sql       # Database schema, RLS, RPCs, storage policies
```

## Design notes

**Direct conversations are keyed, not duplicated.** `get_or_create_direct_conversation`
builds a key from the two user ids sorted alphabetically, so starting a chat from
either side resolves to the same row.

**Read state lives on the membership row.** `conversation_members.last_read_at` is
per user per conversation, which is what makes group read receipts work — a single
per-conversation field could only model "read by everyone".

**Realtime subscriptions are scoped.** The chat screen subscribes to
`messages:{conversationId}` and typing changes filtered to that conversation, so
a user only receives events for conversations they are in.

**Media paths encode the conversation id.** Objects live at
`{conversationId}/{filename}` in the `chat-media` bucket, and the storage RLS
policy checks membership using the first path segment. That keeps the write
permission in the database rather than in client code.

## Scripts

```bash
npm start          # Start the dev server
npm run android    # Open on Android
npm run ios        # Open on iOS
npm run web        # Open in the browser
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npx expo-doctor    # Diagnose config and dependency issues
```

## What is not built yet

- Message editing, deletion, replies, or reactions
- Voice and video calls
- End-to-end encryption (the transport is TLS, but the server sees plaintext)
- Push delivery from the server — tokens are stored, but you still need a
  trigger (Supabase Edge Function on message insert) that calls Expo's push API
- Pagination beyond the most recent 50 messages per conversation
- Offline message queue
