"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { renderDocumentPages, type DocIssue } from "@/lib/api/docs";
import { renderResumePages, type RenderInput } from "@/lib/api/resumes";
import { Button } from "@/components/ui/button";
import { Lozenge } from "@/components/ui/lozenge";
import { PdfPages } from "@/components/ui/pdf-pages";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";

type ResumePreviewProps = {
  /** With `document` set, the document is rendered; otherwise the form data with its template. */
  input: RenderInput;
  /** False while required fields are missing (or the document JSON doesn't parse): nothing is sent. */
  ready: boolean;
  onFieldErrors: (errors: Record<string, string>) => void;
  /** Broken document rules (400 DOCUMENT_INVALID), empty when the document rendered. */
  onDocumentIssues?: (issues: DocIssue[]) => void;
  /** Text selected in the preview, to jump to where it's written (like SyncTeX) */
  onTextSelect?: (text: string, occurrence: number) => void;
};

const AUTO_APPLY_KEY = "careerpilot.preview.autoApply";

function readAutoApply() {
  try {
    return window.localStorage.getItem(AUTO_APPLY_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Live preview: the server creates the PDF and the browser draws each page as an image, so what you see is exactly
 * what downloads — same fonts, margins and page breaks.
 *
 * Auto-apply (default) re-renders shortly after each change. With it off, changes wait for Apply, which saves
 * server work on long documents; the first render still happens on its own.
 */
export function ResumePreview({ input, ready, onFieldErrors, onDocumentIssues, onTextSelect }: ResumePreviewProps) {
  const { getToken } = useAuth();
  /** The last rendered PDF (base64) and its page count */
  const [pdf, setPdf] = useState<{ data: string; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoApply, setAutoApply] = useState(true);
  /** The input of the last render (or the one in progress) */
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  /** Bumped by Apply to render the current input now */
  const [applyCount, setApplyCount] = useState(0);
  const key = JSON.stringify(input);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => setAutoApply(readAutoApply()), []);

  function changeAutoApply(on: boolean) {
    setAutoApply(on);
    try {
      window.localStorage.setItem(AUTO_APPLY_KEY, String(on));
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only
    }
  }

  const stale = ready && renderedKey !== key;
  // Render when auto-apply is on and something changed, when Apply was pressed, or for the very first preview
  const shouldRender = ready && stale && (autoApply || renderedKey === null || applyCount > 0);

  /** Renders one input; a newer render cancels an older one still in flight. */
  async function render(requestKey: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRenderedKey(requestKey);
    setApplyCount(0);
    setLoading(true);
    try {
      const request = JSON.parse(requestKey) as RenderInput;
      const token = await getToken();
      const result = request.document
        ? await renderDocumentPages(request.document, token, controller.signal)
        : await renderResumePages(request, token, controller.signal);
      if (controller.signal.aborted) return;
      setPdf({ data: result.pdf, pages: result.pageCount });
      setError(null);
      onFieldErrors({});
      onDocumentIssues?.([]);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof ApiError) {
        setError(caught.issues.length > 0 ? `${caught.message} See the list under the document.` : caught.message);
        onFieldErrors(caught.fieldErrors);
        onDocumentIssues?.(caught.issues);
      } else {
        setError("The preview couldn't be updated.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!shouldRender) return;
    // Debounced while typing; Apply renders straight away
    const timer = setTimeout(() => void render(key), autoApply && applyCount === 0 ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render only when the input or the apply request changes
  }, [key, shouldRender, applyCount]);

  // Leaving the page cancels a render in flight
  useEffect(() => () => controllerRef.current?.abort(), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-subtle">
        <span className="flex items-center gap-2">
          Preview{pdf ? ` · ${pdf.pages} ${pdf.pages === 1 ? "page" : "pages"}` : ""}
          {loading && <Spinner size="sm" label="Updating preview" />}
          {!loading && stale && renderedKey !== null && <Lozenge appearance="moved">Not applied</Lozenge>}
        </span>
        <span className="flex items-center gap-3">
          <Toggle id="preview-auto-apply" label="Auto-apply" checked={autoApply} onCheckedChange={changeAutoApply} />
          {!autoApply && (
            <Button size="compact" variant={stale ? "primary" : "default"} disabled={!ready || loading || !stale}
              onClick={() => setApplyCount((n) => n + 1)}>
              <RefreshCw /> Apply
            </Button>
          )}
        </span>
      </div>
      {!ready && (
        <SectionMessage appearance="information" title="Add your name to see the preview" />
      )}
      {error && (
        <SectionMessage appearance="warning" title="Preview not updated">
          {error}
        </SectionMessage>
      )}
      {pdf && (
        <div
          className="flex max-h-[75dvh] min-h-96 flex-col overflow-y-auto overscroll-contain rounded-sm border border-border bg-surface-sunken p-2 @md:p-4"
          aria-busy={loading}
        >
          <PdfPages pdf={pdf.data} label="Resume" onTextSelect={onTextSelect} />
        </div>
      )}
    </div>
  );
}
