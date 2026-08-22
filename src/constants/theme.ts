/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#14171A',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    background: '#F6F6F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDEEF2',
    border: '#EBEBE6',
  },
  dark: {
    text: '#F5F5F5',
    textSecondary: '#A0A4AB',
    textMuted: '#75797F',
    background: '#101113',
    backgroundElement: '#1C1D20',
    backgroundSelected: '#27292D',
    border: '#2A2C30',
  },
} as const;

/** Sparingly-used status colors: icons/badges/borders only, never a full-width block. */
export const StatusColors = {
  success: '#2FA766',
  warning: '#D89B2A',
  danger: '#E0524A',
  brand: '#3C87F7',
} as const;

/** Fallback accent palette for courses without an assigned colorTag. */
export const CourseAccentPalette = ['#3C87F7', '#E0A93C', '#4CAF7D', '#B37FEB', '#F2789F', '#4DB6C6'];

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
