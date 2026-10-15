"use client";

import { useState } from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { keyFromLabel, placeholderOf, type UserField } from "@/lib/api/fields";
import { useDriveDocuments, useDriveStatus } from "@/lib/drive/use-drive";
import { ROUTES } from "@/lib/routes";
import { useSaveUserFields, useUserFields } from "@/lib/settings/use-user-fields";
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

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

type AddDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with this key (e.g. a missing {{resume_url}}), name and key can still be changed */
  initialKey?: string;
  /** The saved detail, e.g. to insert its placeholder where the user was typing */
  onAdded?: (field: UserField) => void;
};

/**
 * Adds or updates one saved detail ({{github}} …) without leaving the page: the same list as Settings → Resume
 * details, usable in resumes, documents and email templates.
 */
export function AddDetailDialog({ open, onOpenChange, initialKey, onAdded }: AddDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && <DetailForm initialKey={initialKey} onClose={() => onOpenChange(false)} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailForm({ initialKey, onClose, onAdded }: { initialKey?: string; onClose: () => void; onAdded?: (field: UserField) => void }) {
  const fields = useUserFields();
  const save = useSaveUserFields();
  const existing = fields.data?.find((f) => f.key === initialKey);
  const [label, setLabel] = useState(existing?.label ?? (initialKey ? initialKey.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : ""));
  const [key, setKey] = useState(initialKey ?? "");
  const [keyEdited, setKeyEdited] = useState(!!initialKey);
  const [value, setValue] = useState(existing?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  // A resume link can be picked from the PDFs already saved to Google Drive (shared by link when uploaded)
  const isResumeLink = /resume|cv/i.test(`${key} ${label}`);
  const drive = useDriveStatus();
  const documents = useDriveDocuments(isResumeLink && !!drive.data?.connected);
  const savedPdfs = (documents.data ?? []).filter((d) => d.webViewLink && d.mimeType === "application/pdf");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // This dialog can open from inside another form (the template editor): don't submit that one too
    event.stopPropagation();
    const field = { key: key.trim(), label: label.trim(), value: value.trim() };
    if (!field.label || !field.value) return setError("Add a name and a value.");
    if (!KEY.test(field.key)) return setError("The key uses lower-case letters, digits and _, starting with a letter.");
    // Update the detail with this key, or add it at the end
    const list = fields.data ?? [];
    const next = list.some((f) => f.key === field.key) ? list.map((f) => (f.key === field.key ? field : f)) : [...list, field];
    save.mutate(next, {
      onSuccess: () => {
        onAdded?.(field);
        onClose();
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save the detail."),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{existing ? "Update detail" : "Add a detail"}</DialogTitle>
        <DialogDescription>
          Saved once, used anywhere as {placeholderOf(key || "key")}: resumes, documents and emails. Manage all of
          them in Settings.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {error && <SectionMessage appearance="error" title={error} />}
        <Field htmlFor="detail-label" label="Name" required>
          <TextField id="detail-label" autoFocus value={label} maxLength={60} placeholder="e.g. Resume link"
            onChange={(e) => {
              setLabel(e.target.value);
              if (!keyEdited) setKey(keyFromLabel(e.target.value));
            }} />
        </Field>
        {isResumeLink && (
          <Field htmlFor="detail-saved-resume" label="Pick a saved resume"
            hint={savedPdfs.length > 0
              ? "Its Google Drive link goes into Value; anyone with the link can view it."
              : drive.data?.connected
                ? "No resumes in Google Drive yet. Use Save to Drive in the resume editor, then pick it here."
                : "Connect Google Drive and save a resume there to pick its link here, or paste any link below."}>
            <Select id="detail-saved-resume" value={savedPdfs.find((d) => d.webViewLink === value)?.id ?? ""}
              disabled={savedPdfs.length === 0}
              onChange={(e) => {
                const doc = savedPdfs.find((d) => d.id === e.target.value);
                if (doc?.webViewLink) setValue(doc.webViewLink);
              }}>
              <option value="">{documents.isPending && drive.data?.connected ? "Loading…" : "Choose a resume…"}</option>
              {savedPdfs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        {isResumeLink && savedPdfs.length === 0 && (
          <Link href={ROUTES.resumes} className="-mt-2 text-xs text-link hover:underline">Open Resumes</Link>
        )}
        <Field htmlFor="detail-value" label="Value" required>
          <TextField id="detail-value" value={value} maxLength={500} placeholder="Link or text"
            onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field htmlFor="detail-key" label="Use as" hint="Lower-case letters, digits and _">
          <TextField id="detail-key" value={key} maxLength={40} spellCheck={false} className="font-mono"
            elemBefore={<span className="font-mono text-xs">{"{{"}</span>}
            onChange={(e) => {
              setKey(e.target.value.toLowerCase());
              setKeyEdited(true);
            }} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" isLoading={save.isPending} disabled={fields.isPending}>
          {existing ? "Save" : "Add detail"}
        </Button>
      </DialogFooter>
    </form>
  );
}
