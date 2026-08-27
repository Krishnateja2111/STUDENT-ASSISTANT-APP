import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { StatusColors } from '@/constants/theme';

export interface AvatarProps {
  name: string;
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ name, size = 56 }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <ThemedText style={[styles.text, { fontSize: size * 0.36 }]}>{initialsOf(name)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: StatusColors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
