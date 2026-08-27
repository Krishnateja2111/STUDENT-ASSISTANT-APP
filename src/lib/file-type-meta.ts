import type { Ionicons } from '@expo/vector-icons';

import { StatusColors } from '@/constants/theme';

export type DocumentFilter = 'all' | 'pdf' | 'image' | 'other';

export function fileTypeMeta(mimeType: string): { icon: keyof typeof Ionicons.glyphMap; color: string; category: DocumentFilter } {
  if (mimeType === 'application/pdf') return { icon: 'document-text', color: StatusColors.danger, category: 'pdf' };
  if (mimeType.startsWith('image/')) return { icon: 'image', color: StatusColors.brand, category: 'image' };
  return { icon: 'document-outline', color: StatusColors.warning, category: 'other' };
}
