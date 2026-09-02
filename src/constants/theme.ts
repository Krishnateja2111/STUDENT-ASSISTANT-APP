/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Gray / green / bone palette (exploratory, per request) — bone is a warm,
// muted off-white rather than a cool neutral gray, so both themes lean warm
// throughout (backgrounds, borders, and text all share the same undertone)
// instead of mixing a warm background with cool grays.
export const Colors = {
  light: {
    text: '#26241F',
    textSecondary: '#6E6A5F',
    textMuted: '#9F9A8C',
    background: '#F4EFE4',
    backgroundElement: '#FFFDF7',
    backgroundSelected: '#EAE2D0',
    border: '#E2D9C4',
  },
  dark: {
    text: '#F2EEE3',
    textSecondary: '#B2AC9B',
    textMuted: '#797464',
    background: '#1B1A16',
    backgroundElement: '#242219',
    backgroundSelected: '#2E2B1F',
    border: '#383527',
  },
} as const;

// Light gray / light green (exploratory, per request — the dark charcoal
// gray didn't land either). Lightened both the brand gray and success
// green a step from the previous pass — still warm-toned, still dark
// enough at `brand` for white button text to stay legible, just softer
// than the near-charcoal before it. warning/danger unchanged.
/** Sparingly-used status colors: icons/badges/borders only, never a full-width block. */
export const StatusColors = {
  success: '#5BC48D',
  warning: '#D89B2A',
  danger: '#C64B3E',
  brand: '#8C8677',
} as const;

/** Fallback accent palette for courses without an assigned colorTag — muted/earthy, to stay in the same family as the rest of the palette while still giving courses distinguishable colors. */
export const CourseAccentPalette = ['#8C8677', '#B08D57', '#6B7F8C', '#8C7A9E', '#7A9E7E', '#A67C6E'];

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Cross-platform card shadow — shadow* for iOS/web (react-native-web maps these to box-shadow), elevation for Android. */
export const CardShadow = {
  shadowColor: '#0F1113',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

/** Minimum comfortable tap target per Apple/Material guidance. */
export const MinTouchTarget = 44;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
