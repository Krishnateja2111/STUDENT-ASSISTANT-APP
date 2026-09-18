import * as Sharing from 'expo-sharing';

export type OpenFileResult = { ok: true } | { ok: false; message: string };

/**
 * Hands a document off to the OS's own viewer/share sheet — the realistic
 * way to "open" an arbitrary file type (docx, pptx, csv, anything without
 * an in-app renderer) without building a custom viewer for every format,
 * which is what virtually every local-first app does for the long tail of
 * file types. Images and PDFs get real in-app viewers instead (see
 * ZoomableImage / PdfViewer) — this is the fallback for everything else.
 */
export async function openFileExternally(uri: string, fileName: string, mimeType?: string): Promise<OpenFileResult> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return { ok: false, message: 'Opening files is not available on this device.' };
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName, UTI: mimeType });
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't open this file." };
  }
}
