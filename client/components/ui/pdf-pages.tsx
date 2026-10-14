"use client";

import "pdfjs-dist/web/pdf_viewer.css";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";

import { base64ToBytes, loadPdfjs } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils";

type PdfPagesProps = {
  /** The PDF as base64 */
  pdf: string;
  /** Used in each page's accessible name, e.g. "Resume" → "Resume page 1 of 2" */
  label?: string;
  className?: string;
  /**
   * Text selected in the pages (on mouse or touch release), with how many times the same text appears before it,
   * so the caller can find the n-th place it's written in the source.
   */
  onTextSelect?: (text: string, occurrence: number) => void;
};

/**
 * Shows a PDF page by page like a PDF viewer: each page is drawn sharply for the screen, with pdf.js's invisible
 * text layer on top so text can be selected and copied, and its links clickable. Pages fit the available width and
 * redraw when it changes (phones included).
 */
function PdfPages({ pdf, label = "Document", className, onTextSelect }: PdfPagesProps) {
  const root = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    loadPdfjs()
      .then((pdfjs) => pdfjs.getDocument({ data: base64ToBytes(pdf) }).promise)
      .then((next) => {
        loaded = next;
        if (cancelled) return void next.destroy();
        setFailed(false);
        setDoc(next);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      // The next PDF replaces this one; free its memory once it's no longer shown
      if (loaded) setTimeout(() => void loaded?.destroy(), 0);
    };
  }, [pdf]);

  /** Reports a finished selection inside the pages. */
  function selectionDone() {
    if (!onTextSelect || !root.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!root.current.contains(range.commonAncestorContainer)) return;
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    // How often the same text appears earlier in the pages (spacing ignored)
    const before = window.document.createRange();
    before.setStart(root.current, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const squash = (value: string) => value.replace(/\s+/g, "").toLowerCase();
    const earlier = squash(before.toString()).split(squash(text)).length - 1;
    onTextSelect(text, earlier);
  }

  if (failed) return <p className="p-4 text-sm text-subtle">This PDF couldn&apos;t be shown.</p>;
  if (!doc) return null;
  return (
    <div ref={root} data-slot="pdf-pages" className={cn("flex w-full flex-col items-center gap-3", className)}
      onMouseUp={selectionDone} onTouchEnd={selectionDone}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <figure key={`${doc.fingerprints[0]}-${i}`} className="flex w-full max-w-[210mm] flex-col items-center gap-1">
          <PdfPage doc={doc} number={i + 1} label={`${label} page ${i + 1} of ${doc.numPages}`} />
          {doc.numPages > 1 && <figcaption className="text-xs text-subtlest">Page {i + 1} of {doc.numPages}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

type PageLink = { url: string; left: number; top: number; width: number; height: number };

/** Links the PDF may open: web, email and phone (anything else in a PDF is ignored). */
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

function PdfPage({ doc, number, label }: { doc: PDFDocumentProxy; number: number; label: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [links, setLinks] = useState<PageLink[]>([]);

  // Follow the available width
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.width ?? 0);
      setWidth((current) => (Math.abs(current - next) > 1 ? next : current));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (width === 0 || !canvas.current || !text.current) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    const target = canvas.current;
    const textContainer = text.current;

    (async () => {
      const pdfjs = await loadPdfjs();
      const page = await doc.getPage(number);
      if (cancelled) return;
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      // Canvas: device pixels for sharpness, CSS pixels for layout
      target.width = Math.floor(viewport.width * pixelRatio);
      target.height = Math.floor(viewport.height * pixelRatio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      setHeight(viewport.height);
      renderTask = page.render({
        canvas: target,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await renderTask.promise;
      if (cancelled) return;

      // Invisible, selectable text placed exactly over the drawn text
      textContainer.replaceChildren();
      textContainer.style.setProperty("--scale-factor", String(scale));
      textContainer.style.setProperty("--user-unit", "1");
      textContainer.style.setProperty("--total-scale-factor", String(scale));
      textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textContainer, viewport });
      await textLayer.render();
      if (cancelled) return;

      // Clickable links where the PDF has link annotations
      const annotations = await page.getAnnotations();
      if (cancelled) return;
      setLinks(annotations
        .filter((a) => a.subtype === "Link" && typeof a.url === "string" && SAFE_LINK.test(a.url))
        .map((a) => {
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect) as [number, number, number, number];
          return { url: a.url as string, left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
        }));
    })().catch(() => {
      // Cancelled by a newer render, or the document was replaced: nothing to show for this one
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, number, width]);

  return (
    <div ref={wrapper} className="w-full">
      <div
        role="document"
        aria-label={label}
        className="relative mx-auto overflow-hidden bg-paper shadow-raised"
        style={{ width: width || undefined, height: height || undefined }}
      >
        <canvas ref={canvas} className="block" aria-hidden />
        <div ref={text} className="textLayer" />
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.url}
            className="absolute z-10 rounded-xs hover:bg-selected/40 focus-visible:ring-2 focus-visible:ring-focus"
            style={{ left: link.left, top: link.top, width: link.width, height: link.height }}
          >
            <span className="sr-only">{link.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export { PdfPages };
