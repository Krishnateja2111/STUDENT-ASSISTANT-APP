import { WebView } from 'react-native-webview';

export interface PdfViewerProps {
  uri: string;
  height: number;
  /** Hides the PDF viewer's own built-in toolbar (page count, zoom, search) — see pdf-viewer.web.tsx for why: a small inline preview looks cluttered with a full toolbar meant for a full page. Defaults to shown, since the full-screen viewer has the room for it. */
  showToolbar?: boolean;
}

/**
 * Native PDF viewing: point a WebView straight at the file. Both Android's
 * WebView (Chromium) and iOS's WKWebView have a built-in native PDF
 * renderer that activates automatically when navigated directly to a PDF
 * resource — no PDF.js or other bundled renderer needed, and no extra
 * native dependency beyond react-native-webview itself.
 */
export function PdfViewer({ uri, height, showToolbar = true }: PdfViewerProps) {
  const source = showToolbar ? uri : `${uri}#toolbar=0`;
  return (
    <WebView
      source={{ uri: source }}
      style={{ width: '100%', height }}
      originWhitelist={['*']}
      allowFileAccess
      allowingReadAccessToURL={uri}
    />
  );
}
