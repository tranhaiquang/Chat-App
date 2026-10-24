import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Message } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/theme';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName: string;
  showSenderName: boolean;
  readByOthers: boolean;
}

export function MessageBubble({
  message,
  isMine,
  senderName,
  showSenderName,
  readByOthers,
}: MessageBubbleProps) {
  const hasText = Boolean(message.body && message.body.trim().length > 0);
  const hasAttachment = Boolean(message.attachment_url);

  return (
    <View
      style={[
        styles.row,
        isMine ? styles.rowMine : styles.rowTheirs,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          !hasText && hasAttachment && styles.bubbleAttachmentOnly,
        ]}
      >
        {showSenderName && !isMine ? (
          <Text style={styles.sender}>{senderName}</Text>
        ) : null}

        {hasAttachment ? (
          <AttachmentContent message={message} isMine={isMine} />
        ) : null}

        {hasText ? (
          <Text
            style={[
              styles.text,
              isMine ? styles.textMine : styles.textTheirs,
            ]}
          >
            {message.body}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <Text style={[styles.time, isMine && styles.timeMine]}>
            {formatTime(message.created_at)}
          </Text>
          {isMine ? (
            <Text style={[styles.tick, readByOthers && styles.tickRead]}>
              {readByOthers ? '✓✓' : '✓'}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AttachmentContent({
  message,
  isMine,
}: {
  message: Message;
  isMine: boolean;
}) {
  if (message.attachment_type === 'image') {
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Image attachment"
        style={styles.imageWrapper}
      >
        <Image
          source={{ uri: message.attachment_url! }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      </Pressable>
    );
  }

  if (message.attachment_type === 'video') {
    return (
      <View style={styles.fileRow}>
        <Text style={styles.fileIcon}>▶</Text>
        <View style={styles.fileMeta}>
          <Text style={[styles.fileName, isMine && styles.textMine]} numberOfLines={1}>
            {message.attachment_name ?? 'Video'}
          </Text>
          <Text style={[styles.fileSize, isMine && styles.timeMine]}>
            {formatBytes(message.attachment_size)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fileRow}>
      <Text style={styles.fileIcon}>📎</Text>
      <View style={styles.fileMeta}>
        <Text style={[styles.fileName, isMine && styles.textMine]} numberOfLines={1}>
          {message.attachment_name ?? 'File'}
        </Text>
        <Text style={[styles.fileSize, isMine && styles.timeMine]}>
          {formatBytes(message.attachment_size)}
        </Text>
      </View>
    </View>
  );
}

/** "14:32" or "Yesterday 14:32" for older messages. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  bubbleMine: {
    backgroundColor: colors.bubbleMine,
    borderBottomRightRadius: radii.sm,
  },
  bubbleTheirs: {
    backgroundColor: colors.bubbleTheirs,
    borderBottomLeftRadius: radii.sm,
  },
  bubbleAttachmentOnly: {
    paddingTop: spacing.xs,
  },
  sender: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  text: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 21,
  },
  textMine: {
    color: colors.bubbleMineText,
  },
  textTheirs: {
    color: colors.bubbleTheirsText,
  },
  imageWrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    backgroundColor: colors.border,
  },
  image: {
    width: 220,
    height: 220,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 180,
  },
  fileIcon: {
    fontSize: 22,
  },
  fileMeta: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    fontWeight: '500',
    color: colors.bubbleTheirsText,
  },
  fileSize: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  timeMine: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tick: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255,255, 0.7)',
  },
  tickRead: {
    color: '#A5B4FC',
  },
});
