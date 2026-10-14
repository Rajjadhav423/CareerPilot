import type * as PdfJs from "pdfjs-dist";

/**
 * pdf.js, loaded on demand in the browser (it only reaches the browser when a PDF preview is shown).
 * The worker parses PDFs off the main thread.
 */
let loading: Promise<typeof PdfJs> | null = null;

export function loadPdfjs(): Promise<typeof PdfJs> {
  loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return loading;
}

export function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
