"use client";

import { useRef, useState } from "react";
import { Link2, Loader2, Sparkles } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { WorkMode } from "@/lib/api/jobs";
import { useCreateJob } from "@/lib/jobs/use-jobs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SectionMessage } from "@/components/ui/section-message";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  title: string;
  company: string;
  location: string;
  workMode: "" | WorkMode;
  jobUrl: string;
  description: string;
};

const EMPTY: FormState = { title: "", company: "", location: "", workMode: "", jobUrl: "", description: "" };

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Enter the job title";
  if (!form.company.trim()) errors.company = "Enter the company";
  if (form.jobUrl.trim() && !/^https?:\/\/\S+$/.test(form.jobUrl.trim())) {
    errors.jobUrl = "Enter a full link starting with https://";
  }
  return errors;
}

type ScrapeState = "idle" | "loading" | "done" | "error";

type AddJobDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Manually add a job to the board (it starts in "Saved"). Paste a LinkedIn link to auto-fill. */
export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scrapeState, setScrapeState] = useState<ScrapeState>("idle");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const scrapeAbortRef = useRef<AbortController | null>(null);
  const createJob = useCreateJob();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setForm(EMPTY);
      setErrors({});
      setScrapeState("idle");
      setScrapeError(null);
      setLinkedinUrl("");
      createJob.reset();
    }
  }

  async function scrapeUrl() {
    const url = linkedinUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      setScrapeError("Enter a full URL starting with https://");
      return;
    }
    setScrapeError(null);
    setScrapeState("loading");

    // Cancel any in-flight request
    scrapeAbortRef.current?.abort();
    const controller = new AbortController();
    scrapeAbortRef.current = controller;

    try {
      const resp = await fetch("/api/scrape-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const data = await resp.json() as {
        title?: string; company?: string; location?: string;
        workMode?: string; description?: string; jobUrl?: string; error?: string;
      };
      if (!resp.ok) {
        setScrapeError(data.error ?? `Server responded with ${resp.status}.`);
        setScrapeState("error");
        return;
      }
      // Auto-fill the form — only overwrite blank fields so user data isn't lost
      setForm((prev) => ({
        title: prev.title || data.title || "",
        company: prev.company || data.company || "",
        location: prev.location || data.location || "",
        workMode: (prev.workMode || (["ONSITE", "HYBRID", "REMOTE"].includes(data.workMode ?? "") ? data.workMode as WorkMode : "")) as "" | WorkMode,
        jobUrl: prev.jobUrl || data.jobUrl || url,
        description: prev.description || data.description || "",
      }));
      setScrapeState("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setScrapeError("Network error — could not reach the server.");
      setScrapeState("error");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    createJob.mutate(
      {
        title: form.title,
        company: form.company,
        location: form.location || null,
        workMode: form.workMode || null,
        jobUrl: form.jobUrl || null,
        description: form.description || null,
      },
      {
        onSuccess: () => close(false),
        onError: (error) => {
          if (error instanceof ApiError) setErrors(error.fieldErrors);
        },
      },
    );
  }

  const serverError = createJob.error instanceof ApiError ? createJob.error.message : createJob.error ? "Unexpected error." : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Add a job</DialogTitle>
            <DialogDescription>It goes into the Saved column of your board.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {serverError && Object.keys(errors).length === 0 && (
              <SectionMessage appearance="error" title="Couldn't save the job">
                {serverError}
              </SectionMessage>
            )}

            {/* ── LinkedIn / job-post URL auto-fill ───────────────────── */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-brand" />
                Auto-fill from URL
              </p>
              <p className="text-xs text-subtlest">
                Paste a LinkedIn job post or any job-listing URL — we'll fill in the details for you.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-subtlest" />
                  <input
                    id="linkedin-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://linkedin.com/jobs/view/…"
                    value={linkedinUrl}
                    onChange={(e) => {
                      setLinkedinUrl(e.target.value);
                      setScrapeState("idle");
                      setScrapeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void scrapeUrl();
                      }
                    }}
                    className="w-full rounded-sm border border-border-input bg-input py-1.5 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-subtlest hover:bg-input-hovered focus:border-focus focus:ring-1 focus:ring-focus aria-[invalid=true]:border-danger-bold"
                    aria-label="Job posting URL to auto-fill from"
                    aria-invalid={scrapeState === "error"}
                    aria-describedby={scrapeState === "error" ? "scrape-error" : undefined}
                  />
                </div>
                <Button
                  type="button"
                  variant="subtle"
                  size="compact"
                  isLoading={scrapeState === "loading"}
                  disabled={!linkedinUrl.trim() || scrapeState === "loading"}
                  onClick={() => void scrapeUrl()}
                >
                  {scrapeState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {scrapeState === "done" ? "Re-fill" : "Auto-fill"}
                </Button>
              </div>
              {scrapeState === "error" && scrapeError && (
                <p id="scrape-error" className="text-xs text-danger-text" role="alert">
                  {scrapeError}
                </p>
              )}
              {scrapeState === "done" && (
                <p className="text-xs text-success-text" role="status">
                  ✓ Details filled in — review and edit as needed.
                </p>
              )}
            </div>

            <Field htmlFor="job-title" label="Job title" required error={errors.title}>
              <TextField
                id="job-title"
                autoFocus
                placeholder="e.g. Backend Engineer"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "job-title-error" : undefined}
                maxLength={200}
              />
            </Field>

            <Field htmlFor="job-company" label="Company" required error={errors.company}>
              <TextField
                id="job-company"
                placeholder="e.g. CRED"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                aria-invalid={!!errors.company}
                aria-describedby={errors.company ? "job-company-error" : undefined}
                maxLength={200}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="job-location" label="Location">
                <TextField
                  id="job-location"
                  placeholder="e.g. Bengaluru"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field htmlFor="job-work-mode" label="Work mode">
                <Select
                  id="job-work-mode"
                  value={form.workMode}
                  onChange={(e) => update("workMode", e.target.value as FormState["workMode"])}
                >
                  <option value="">Not specified</option>
                  <option value="ONSITE">On-site</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="REMOTE">Remote</option>
                </Select>
              </Field>
            </div>

            <Field htmlFor="job-url" label="Job posting link" hint="Where you found it or where to apply" error={errors.jobUrl}>
              <TextField
                id="job-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={form.jobUrl}
                onChange={(e) => update("jobUrl", e.target.value)}
                aria-invalid={!!errors.jobUrl}
                aria-describedby={errors.jobUrl ? "job-url-error" : undefined}
                maxLength={2048}
              />
            </Field>

            <Field htmlFor="job-description" label="Job description" hint="Paste it here; it's used later for matching your profile">
              <Textarea
                id="job-description"
                rows={5}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                maxLength={20000}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" isLoading={createJob.isPending}>
              Add job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
