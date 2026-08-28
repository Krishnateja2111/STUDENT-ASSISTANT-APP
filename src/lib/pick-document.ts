import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uri: string;
}

export type PickDocumentResult =
  | { status: 'picked'; file: PickedFile }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Opens the system file picker. Never throws — failures come back as a typed result instead of an unhandled rejection. */
export async function pickDocument(): Promise<PickDocumentResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (result.canceled || !result.assets?.[0]) return { status: 'cancelled' };

    const asset = result.assets[0];
    return {
      status: 'picked',
      file: {
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: asset.size ?? 0,
        uri: asset.uri,
      },
    };
  } catch {
    return { status: 'error', message: "Couldn't open the file picker. Please try again." };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
