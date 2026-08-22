import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from './themed-text';

import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';

export type ButtonVariant = 'filled' | 'outlined';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'filled',
  color = StatusColors.brand,
  disabled,
  style,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' ? { backgroundColor: color } : { borderWidth: 1.5, borderColor: color },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <ThemedText type="cardTitle" style={variant === 'filled' ? styles.filledText : { color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledText: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
