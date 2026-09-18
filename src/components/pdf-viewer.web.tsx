import { createElement, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from './themed-text';

export interface PdfViewerProps {
  uri: string;
  height: number;
  /**
   * Hides the browser's own built-in PDF toolbar (hamburger menu, zoom,
   * page count, search). Bug fix (caught live, real-file test): a small
   * inline preview showed that FULL toolbar crammed into a ~320px box —
   * cluttered and tiny, clearly not what an in-app preview should look
   * like. The `#toolbar=0` URL fragment is Chromium's own documented way
   * to suppress it. Defaults to shown, since the full-screen viewer (see
   * PdfViewerModal) has the room for it to be genuinely useful there.
   */
  showToolbar?: boolean;
}

/**
 * Web PDF viewing: an <iframe>, which browsers render PDFs into natively.
 *
 * Bug fix (caught live): pointing the iframe straight at the persisted
 * `data:application/pdf;...` URI doesn't work — verified directly (not
 * just in this app) that Chromium treats a data: URI PDF as a download
 * ("Download is starting"), not something to render inline, even at the
 * top level. blob: URLs don't have that restriction and render normally.
 * So the durable data: URI (needed so the file survives a reload — see
 * pick-document.ts) is converted to a throwaway blob: URL right here, only
 * for this render; storage never changes, and the blob is revoked when
 * this view goes away.
 */
export function PdfViewer({ uri, height, showToolbar = true }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(uri)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri]);

  if (error) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="meta" themeColor="textSecondary">
          Couldn&apos;t load this PDF.
        </ThemedText>
      </View>
    );
  }

  if (!blobUrl) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="meta" themeColor="textMuted">
          Loading…
        </ThemedText>
      </View>
    );
  }

  return createElement('iframe', {
    src: showToolbar ? blobUrl : `${blobUrl}#toolbar=0`,
    style: { width: '100%', height, border: 'none' },
    title: 'PDF preview',
  });
}
