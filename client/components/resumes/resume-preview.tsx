"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { ApiError } from "@/lib/api/client";
import { renderResumePreview, type RenderInput } from "@/lib/api/resumes";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

type ResumePreviewProps = {
  input: RenderInput;
  /** False while required fields are missing: nothing is sent to the server. */
  ready: boolean;
  onFieldErrors: (errors: Record<string, string>) => void;
};

/**
 * Live preview rendered by the server with the same template as the PDF. Shown in a sandboxed frame with
 * scripts, forms and same-origin access all disabled, so the document can never run code in the app.
 */
export function ResumePreview({ input, ready, onFieldErrors }: ResumePreviewProps) {
  const { getToken } = useAuth();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(input);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    // Debounced: re-render shortly after the user stops typing
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await renderResumePreview(JSON.parse(key) as RenderInput, await getToken(), controller.signal);
        setHtml(next);
        setError(null);
        onFieldErrors({});
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError) {
          setError(caught.message);
          onFieldErrors(caught.fieldErrors);
        } else {
          setError("The preview couldn't be updated.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render only when the document input changes
  }, [key, ready]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2 text-xs text-subtle">
        <span>Preview · the PDF uses the same layout with embedded fonts</span>
        {loading && <Spinner size="sm" label="Updating preview" />}
      </div>
      {!ready && (
        <SectionMessage appearance="information" title="Add your name to see the preview" />
      )}
      {error && (
        <SectionMessage appearance="warning" title="Preview not updated">
          {error}
        </SectionMessage>
      )}
      {html && (
        <iframe
          title="Resume preview"
          sandbox=""
          srcDoc={html}
          className="h-[70dvh] min-h-96 w-full rounded-sm border border-border bg-surface-sunken"
        />
      )}
    </div>
  );
}
