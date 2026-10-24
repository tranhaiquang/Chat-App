import { Platform } from 'react-native';

/** Design tokens. Single source of truth for colors, spacing, and radii. */

export const colors = {
  background: '#FFFFFF',
  surface: '#F7F7F9',
  surfaceElevated: '#FFFFFF',
  border: '#E6E6EA',
  borderStrong: '#D3D3DA',

  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF0FF',

  bubbleMine: '#4F46E5',
  bubbleMineText: '#FFFFFF',
  bubbleTheirs: '#F0F0F3',
  bubbleTheirsText: '#111114',

  text: '#111114',
  textSecondary: '#6B6B76',
  textTertiary: '#9A9AA5',
  textInverse: '#FFFFFF',

  danger: '#E5484D',
  success: '#30A46C',
  online: '#30A46C',

  overlay: 'rgba(0, 0, 0, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  bodySmall: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  micro: { fontSize: 11, color: colors.textTertiary },
} as const;

/** Cross-platform font stack. */
export const fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;
