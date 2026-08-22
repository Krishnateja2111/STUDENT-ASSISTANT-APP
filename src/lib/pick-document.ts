import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uri: string;
}

/** Opens the system file picker. Returns null if the user cancels. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    fileName: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    sizeBytes: asset.size ?? 0,
    uri: asset.uri,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
