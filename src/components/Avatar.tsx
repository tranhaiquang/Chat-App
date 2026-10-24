import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
}

/** Derives up to two initials from a display name. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic pastel colour so the same person always gets the same tint. */
function colorFromName(name: string): string {
  const palette = [
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#F97316',
    '#10B981',
    '#0EA5E9',
    '#EF4444',
    '#14B8A6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return palette[hash % palette.length];
}

export function Avatar({
  uri,
  name,
  size = 44,
  showOnline = false,
  isOnline = false,
}: AvatarProps) {
  const dotSize = Math.max(10, Math.round(size * 0.28));

  if (uri) {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
        />
        {showOnline && isOnline ? (
          <View
            style={[
              styles.onlineDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                right: 0,
                bottom: 0,
              },
            ]}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colorFromName(name),
          },
        ]}
      >
        <Text
          style={[
            styles.initials,
            { fontSize: Math.round(size * 0.38) },
          ]}
        >
          {initialsFrom(name)}
        </Text>
      </View>
      {showOnline && isOnline ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textInverse,
    fontFamily: fonts.medium,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
