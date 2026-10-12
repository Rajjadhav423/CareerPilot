"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { ApiError } from "@/lib/api/client";
import { renderResumePages, type RenderInput } from "@/lib/api/resumes";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

type ResumePreviewProps = {
  input: RenderInput;
  /** False while required fields are missing: nothing is sent to the server. */
  ready: boolean;
  onFieldErrors: (errors: Record<string, string>) => void;
};

/**
 * Live preview: the server creates the PDF and sends each page as an image, so what you see is exactly what
 * downloads — same fonts, margins and page breaks. Images scale to any screen width, phones included.
 */
export function ResumePreview({ input, ready, onFieldErrors }: ResumePreviewProps) {
  const { getToken } = useAuth();
  const [pages, setPages] = useState<string[] | null>(null);
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
        const result = await renderResumePages(JSON.parse(key) as RenderInput, await getToken(), controller.signal);
        setPages(result.pages);
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
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render only when the document input changes
  }, [key, ready]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2 text-xs text-subtle">
        <span>
          Preview{pages ? ` · ${pages.length} ${pages.length === 1 ? "page" : "pages"}` : ""} · exactly as the PDF
        </span>
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
      {pages && (
        <div
          className="flex max-h-[75dvh] min-h-96 flex-col items-center gap-3 overflow-y-auto overscroll-contain rounded-sm border border-border bg-surface-sunken p-2 @md:p-4"
          aria-busy={loading}
        >
          {pages.map((png, i) => (
            <figure key={i} className="flex w-full max-w-[210mm] flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing for next/image to optimise */}
              <img
                src={`data:image/png;base64,${png}`}
                alt={`Resume page ${i + 1} of ${pages.length}`}
                className="h-auto w-full shadow-raised"
                draggable={false}
              />
              {pages.length > 1 && (
                <figcaption className="text-xs text-subtlest">
                  Page {i + 1} of {pages.length}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
