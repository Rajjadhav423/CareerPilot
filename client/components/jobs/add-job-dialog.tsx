"use client";

import { useState } from "react";

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

type AddJobDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Manually add a job to the board (it starts in "Saved"). */
export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
      createJob.reset();
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
