import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export interface PickedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uri: string;
}

export interface SkippedFile {
  fileName: string;
  reason: string;
}

export type PickDocumentsResult =
  | { status: 'picked'; files: PickedFile[]; skipped: SkippedFile[] }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

// Documents here are meant to be course materials (readings, assignment
// PDFs, scanned notes) -- not a general-purpose file store. Enforced mainly
// for the web path, where the whole file gets base64-embedded into
// localStorage (see persistWeb below) and one large file could blow the
// browser's ~5-10MB storage budget for the ENTIRE app, not just itself.
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

function documentsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'documents');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Copies a native document-picker asset into the app's OWN permanent
 * document directory. The picker's own uri -- even with the default
 * copyToCacheDirectory -- points into the app's CACHE dir, which the OS is
 * free to purge under storage pressure; nothing there is guaranteed to
 * survive. This makes a real, permanent copy this app owns instead.
 */
async function persistNative(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  const dir = documentsDirectory();
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${asset.name}`;
  const sourceFile = new File(asset.uri);
  const destFile = new File(dir, uniqueName);
  await sourceFile.copy(destFile);
  return destFile.uri;
}

/**
 * Bug fix: on web, the picker's own uri is a `blob:` URL -- valid only as
 * long as the browser tab/document that created it stays alive. Reload the
 * page (or just reopen the app later) and it's dead: the document still
 * shows up in the list (its metadata persisted fine), but its actual
 * content is gone. Reproduced live: fetching the blob: URL succeeds right
 * after upload, then fails with "Failed to fetch" immediately after a
 * reload. A data: URI is a plain string with the file's bytes embedded
 * directly in it -- it survives in localStorage exactly like any other
 * persisted field, with no live browser object behind it to lose.
 */
function persistWeb(asset: DocumentPicker.DocumentPickerAsset): string {
  // Bug fix (caught live): expo-document-picker's web `base64` field is
  // already a complete `data:<mime>;base64,<payload>` string, not a bare
  // payload — wrapping it in another `data:...;base64,` prefix produced a
  // malformed double-prefixed URI (verified: fetch() failed on it even
  // though it should otherwise have survived a reload just fine).
  if (asset.base64) return asset.base64.startsWith('data:') ? asset.base64 : `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.base64}`;
  // Fallback for the rare case base64 wasn't populated: if uri is already a
  // data: URI, it's already just as durable as-is.
  if (asset.uri.startsWith('data:')) return asset.uri;
  throw new Error('No durable representation available for this file.');
}

/** Opens the system file picker, allowing multiple files at once. Never throws — failures come back as a typed result instead of an unhandled rejection. */
export async function pickDocuments(): Promise<PickDocumentsResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, base64: true });
    if (result.canceled || !result.assets || result.assets.length === 0) return { status: 'cancelled' };

    const files: PickedFile[] = [];
    const skipped: SkippedFile[] = [];

    for (const asset of result.assets) {
      const sizeBytes = asset.size ?? 0;
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        skipped.push({
          fileName: asset.name,
          reason: `too large (${formatFileSize(sizeBytes)}, max ${formatFileSize(MAX_FILE_SIZE_BYTES)})`,
        });
        continue;
      }
      try {
        const uri = Platform.OS === 'web' ? persistWeb(asset) : await persistNative(asset);
        files.push({
          fileName: asset.name,
          mimeType: asset.mimeType ?? 'application/octet-stream',
          sizeBytes,
          uri,
        });
      } catch {
        skipped.push({ fileName: asset.name, reason: "couldn't be saved" });
      }
    }

    if (files.length === 0 && skipped.length > 0) {
      return { status: 'error', message: skipped.map((s) => `${s.fileName} (${s.reason})`).join(', ') };
    }
    return { status: 'picked', files, skipped };
  } catch {
    return { status: 'error', message: "Couldn't open the file picker. Please try again." };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
