export type OpenFileResult = { ok: true } | { ok: false; message: string };

/**
 * Web counterpart to open-file.ts — expo-sharing has no web implementation,
 * so this triggers a browser download instead via a temporary <a download>
 * element. That's used (rather than window.open(uri)) because some
 * browsers block top-level navigation to a data: URI from script, but a
 * user-gesture-triggered download of one works reliably everywhere.
 */
export async function openFileExternally(uri: string, fileName: string): Promise<OpenFileResult> {
  try {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't open this file." };
  }
}
