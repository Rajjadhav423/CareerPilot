"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, Pencil } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { EmailTemplate, MergeField } from "@/lib/api/templates";
import { findUnknownPlaceholders, insertAtCursor } from "@/lib/email/placeholders";
import { useMergeFields, usePreviewTemplate, useSaveTemplate } from "@/lib/email/use-templates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { MergeFieldMenu } from "./merge-field-menu";

type FormState = { name: string; subject: string; body: string; isDefault: boolean };
type Target = "subject" | "body";

const EMPTY: FormState = { name: "", subject: "", body: "", isDefault: false };

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Give the template a name";
  if (!form.subject.trim()) errors.subject = "Enter a subject";
  if (!form.body.trim()) errors.body = "Write the email";
  return errors;
}

type TemplateEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template to edit; omitted to create a new one. */
  template?: EmailTemplate | null;
};

/** Create or edit a template, insert merge fields at the cursor, and preview it with sample data. */
export function TemplateEditorDialog({ open, onOpenChange, template }: TemplateEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {/* Keyed so the form starts fresh for each template */}
        {open && <TemplateForm key={template?.id ?? "new"} template={template} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({ template, onDone }: { template?: EmailTemplate | null; onDone: () => void }) {
  const [form, setForm] = useState<FormState>(
    template
      ? { name: template.name, subject: template.subject, body: template.body, isDefault: template.isDefault }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [target, setTarget] = useState<Target>("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const mergeFields = useMergeFields();
  const save = useSaveTemplate();
  const preview = usePreviewTemplate();

  const allowedKeys = useMemo(() => new Set((mergeFields.data ?? []).map((f) => f.key)), [mergeFields.data]);
  const unknown = mergeFields.data
    ? findUnknownPlaceholders(`${form.subject}\n${form.body}`, allowedKeys)
    : [];

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

  function insertField(field: MergeField) {
    // Inputs keep their selection after losing focus to the menu, so this is where the user left the cursor
    const element = target === "subject" ? subjectRef.current : bodyRef.current;
    const selection = element ? { start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 } : null;
    const { value, cursor } = insertAtCursor(form[target], field.placeholder, selection);
    update(target, value);
    // After the menu closes and React re-renders: put focus and cursor back after the inserted field
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(cursor, cursor);
    });
  }

  function showPreview() {
    setMode("preview");
    preview.mutate({ subject: form.subject, body: form.body });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || unknown.length > 0) {
      setMode("edit");
      return;
    }
    save.mutate(
      { id: template?.id, input: { ...form, name: form.name.trim() } },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (error instanceof ApiError) setErrors(error.fieldErrors);
        },
      },
    );
  }

  const serverError = save.error instanceof ApiError ? save.error.message : save.error ? "Unexpected error." : null;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
        <DialogDescription>
          Fields like {"{{job_title}}"} are filled in from the job and your profile when you write an email.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-1 px-6 pt-2" role="group" aria-label="Editor mode">
        <Button size="compact" variant="subtle" isSelected={mode === "edit"} onClick={() => setMode("edit")}>
          <Pencil /> Edit
        </Button>
        <Button size="compact" variant="subtle" isSelected={mode === "preview"} onClick={showPreview}>
          <Eye /> Preview
        </Button>
      </div>

      <DialogBody className="flex flex-col gap-4 py-4">
        {serverError && Object.keys(errors).length === 0 && (
          <SectionMessage appearance="error" title="Couldn't save the template">
            {serverError}
          </SectionMessage>
        )}

        {mergeFields.error && (
          <SectionMessage appearance="warning" title="Couldn't load the merge fields">
            You can still edit the text; inserting fields is unavailable until the page is reloaded.
          </SectionMessage>
        )}

        {unknown.length > 0 && (
          <SectionMessage appearance="warning" title="Unsupported placeholders">
            Remove or fix {unknown.map((u) => `"${u}"`).join(", ")}. Only the fields in the Insert field menu can be used.
          </SectionMessage>
        )}

        {mode === "edit" ? (
          <>
            <Field htmlFor="template-name" label="Template name" required error={errors.name}>
              <TextField
                id="template-name"
                autoFocus={!template}
                placeholder="e.g. Cold application"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "template-name-error" : undefined}
                maxLength={100}
              />
            </Field>

            <div className="flex flex-col gap-1">
              <div className="flex items-end justify-between gap-2">
                <label htmlFor="template-subject" className="text-xs font-semibold text-subtle">
                  Subject<span className="text-danger-text" aria-hidden> *</span>
                </label>
                <MergeFieldMenu
                  fields={mergeFields.data ?? []}
                  target={target}
                  onInsert={insertField}
                  disabled={!mergeFields.data}
                />
              </div>
              <TextField
                id="template-subject"
                ref={subjectRef}
                placeholder="e.g. Application for {{job_title}} at {{company_name}}"
                value={form.subject}
                // The subject is one line: pasted line breaks become spaces (the server rejects them anyway)
                onChange={(e) => update("subject", e.target.value.replace(/[\r\n]+/g, " "))}
                onFocus={() => setTarget("subject")}
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? "template-subject-error" : undefined}
                maxLength={255}
              />
              {errors.subject && (
                <p id="template-subject-error" className="text-xs text-danger-text" role="alert">
                  {errors.subject}
                </p>
              )}
            </div>

            <Field
              htmlFor="template-body"
              label="Body"
              required
              error={errors.body}
              hint="Plain text. Insert field adds to whichever box you were last typing in."
            >
              <Textarea
                id="template-body"
                ref={bodyRef}
                rows={10}
                className="min-h-48"
                placeholder={"Hi,\n\nI'd like to apply for the {{job_title}} role at {{company_name}}…"}
                value={form.body}
                onChange={(e) => update("body", e.target.value)}
                onFocus={() => setTarget("body")}
                aria-invalid={!!errors.body}
                aria-describedby={errors.body ? "template-body-error" : undefined}
                maxLength={20000}
              />
            </Field>

            <Checkbox
              id="template-default"
              checked={form.isDefault}
              onCheckedChange={(checked) => update("isDefault", checked === true)}
              label="Use as my default template"
              description="Picked automatically when you write an application email. Only one template can be the default."
            />
          </>
        ) : (
          <TemplatePreviewPanel preview={preview} />
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" isLoading={save.isPending} disabled={unknown.length > 0}>
          {template ? "Save changes" : "Create template"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TemplatePreviewPanel({ preview }: { preview: ReturnType<typeof usePreviewTemplate> }) {
  if (preview.isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-subtle">
        <Spinner /> Rendering preview…
      </div>
    );
  }
  if (preview.error) {
    return (
      <SectionMessage appearance="error" title="Couldn't render the preview">
        {preview.error instanceof ApiError ? preview.error.message : "Unexpected error."}
      </SectionMessage>
    );
  }
  if (!preview.data) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-subtlest">Shown with sample data. Real emails use the job&apos;s and your details.</p>
      <div className="rounded-sm border border-border">
        <div className="border-b border-border px-3 py-2">
          <span className="text-xs font-semibold text-subtle">Subject </span>
          <span className="break-words">{preview.data.subject || <em className="text-subtlest">(empty)</em>}</span>
        </div>
        {/* Rendered as text: React escapes it, so nothing in a template can become markup */}
        <div className="px-3 py-3 text-sm break-words whitespace-pre-wrap">
          {preview.data.body || <em className="text-subtlest">(empty)</em>}
        </div>
      </div>
    </div>
  );
}
