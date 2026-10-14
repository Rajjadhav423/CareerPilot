"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Plus, Save, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { keyFromLabel, placeholderOf, SUGGESTED_FIELDS, type UserField } from "@/lib/api/fields";
import { useSaveUserFields, useUserFields } from "@/lib/settings/use-user-fields";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { Tooltip } from "@/components/ui/tooltip";

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_FIELDS = 50;

/** A row being edited; `keyEdited` stops the key following the label once the user changed it. */
type Row = UserField & { id: number; keyEdited: boolean };

let nextId = 1;
const toRows = (fields: UserField[]): Row[] => fields.map((f) => ({ ...f, id: nextId++, keyEdited: true }));

/** Problems per row id and field, shown under the inputs. */
function validate(rows: Row[]): Record<number, { key?: string; label?: string; value?: string }> {
  const problems: Record<number, { key?: string; label?: string; value?: string }> = {};
  const seen = new Map<string, number>();
  for (const row of rows) {
    const p: { key?: string; label?: string; value?: string } = {};
    if (!row.label.trim()) p.label = "Add a name";
    if (!KEY.test(row.key)) p.key = "Lower-case letters, digits and _, starting with a letter";
    else if (seen.has(row.key)) p.key = "Already used by another detail";
    if (!row.value.trim()) p.value = "Add a value";
    seen.set(row.key, row.id);
    if (Object.keys(p).length > 0) problems[row.id] = p;
  }
  return problems;
}

/**
 * Details you fill in once (GitHub, LinkedIn, LeetCode, portfolio …) and use in any resume or document as {{key}}.
 * They're filled in whenever a preview or PDF is made, so changing one here updates every resume.
 */
export function ResumeDetailsSettings() {
  const fields = useUserFields();
  const save = useSaveUserFields();

  return (
    <Card className="gap-4 p-4 @md:p-5">
      <CardHeader className="p-0">
        <div className="min-w-0">
          <CardTitle>Resume details</CardTitle>
          <CardDescription className="mt-1">
            Save links and details once, then write them as <code className="rounded-xs bg-neutral px-1 font-mono text-xs">{"{{github}}"}</code> in
            any resume field or document. They&apos;re filled in when the preview or PDF is made, so changing one here
            updates every resume.
          </CardDescription>
        </div>
      </CardHeader>

      {fields.isPending && <div className="flex items-center gap-2 py-4 text-sm text-subtle"><Spinner /> Loading…</div>}
      {fields.error && (
        <SectionMessage appearance="error" title="Couldn't load your details">
          {fields.error instanceof ApiError ? fields.error.message : "Unexpected error."}
        </SectionMessage>
      )}
      {/* Remounted with each saved list, so editing always starts from what's stored */}
      {fields.data && <DetailsEditor key={JSON.stringify(fields.data)} saved={fields.data} save={save} />}
    </Card>
  );
}

function DetailsEditor({ saved, save }: { saved: UserField[]; save: ReturnType<typeof useSaveUserFields> }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(saved));
  const [copied, setCopied] = useState<string | null>(null);

  const problems = useMemo(() => validate(rows), [rows]);
  const current = rows.map(({ key, label, value }) => ({ key, label: label.trim(), value: value.trim() }));
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);
  const used = new Set(rows.map((r) => r.key));

  function update(id: number, change: Partial<Row>) {
    setRows((list) => list.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...change };
      // The key follows the name until it's edited by hand
      if (change.label !== undefined && !row.keyEdited) next.key = keyFromLabel(change.label);
      return next;
    }));
  }

  function add(field?: { key: string; label: string }) {
    setRows((list) => [...list, {
      id: nextId++, key: field?.key ?? "", label: field?.label ?? "", value: "", keyEdited: !!field,
    }]);
  }

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(placeholderOf(key));
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // Clipboard blocked: the placeholder is visible next to the field anyway
    }
  }

  const suggestions = SUGGESTED_FIELDS.filter((s) => !used.has(s.key));

  return (
    <>
          {rows.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-sm text-subtle">
              No details yet. Add GitHub, LinkedIn or anything you put on every resume.
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Saved details">
              {rows.map((row) => {
                const p = problems[row.id] ?? {};
                return (
                  <li key={row.id} className="@container rounded-sm border border-border bg-surface p-3">
                    <div className="grid gap-2 @lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] @lg:items-start">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`field-label-${row.id}`} className="text-xs font-semibold text-subtle">Name</label>
                        <TextField id={`field-label-${row.id}`} value={row.label} maxLength={60} placeholder="e.g. GitHub"
                          aria-invalid={!!p.label} onChange={(e) => update(row.id, { label: e.target.value })} />
                        {p.label && <span className="text-xs text-danger-text">{p.label}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`field-value-${row.id}`} className="text-xs font-semibold text-subtle">Value</label>
                        <TextField id={`field-value-${row.id}`} value={row.value} maxLength={500}
                          placeholder={SUGGESTED_FIELDS.find((s) => s.key === row.key)?.example ?? "Link or text"}
                          aria-invalid={!!p.value} onChange={(e) => update(row.id, { value: e.target.value })} />
                        {p.value && <span className="text-xs text-danger-text">{p.value}</span>}
                      </div>
                      <div className="flex items-end gap-1 @lg:pt-5">
                        <Tooltip content="Remove">
                          <Button variant="subtle" size="icon" aria-label={`Remove ${row.label || "detail"}`}
                            onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}>
                            <Trash2 />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span>Use as</span>
                      <span className="flex items-center rounded-xs border border-border-input bg-input font-mono">
                        <span aria-hidden className="pl-1.5 text-subtlest">{"{{"}</span>
                        <input
                          aria-label={`Key for ${row.label || "this detail"}`}
                          aria-invalid={!!p.key}
                          value={row.key}
                          maxLength={40}
                          spellCheck={false}
                          onChange={(e) => update(row.id, { key: e.target.value.toLowerCase(), keyEdited: true })}
                          className="w-28 bg-transparent px-0.5 py-0.5 text-foreground outline-none"
                        />
                        <span aria-hidden className="pr-1.5 text-subtlest">{"}}"}</span>
                      </span>
                      <Button size="compact" variant="subtle" disabled={!!p.key} onClick={() => copy(row.key)}>
                        {copied === row.key ? <Check /> : <Copy />} {copied === row.key ? "Copied" : "Copy"}
                      </Button>
                      {p.key && <span className="text-danger-text">{p.key}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2">
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Suggested details">
                <span className="text-xs text-subtle">Add:</span>
                {suggestions.map((s) => (
                  <Button key={s.key} size="compact" variant="default" disabled={rows.length >= MAX_FIELDS}
                    onClick={() => add(s)}>
                    <Plus /> {s.label}
                  </Button>
                ))}
              </div>
            )}
            <div>
              <Button size="compact" variant="subtle" disabled={rows.length >= MAX_FIELDS} onClick={() => add()}>
                <Plus /> Custom detail
              </Button>
            </div>
          </div>

          {save.error && (
            <SectionMessage appearance="error" title="Couldn't save">
              {save.error instanceof ApiError ? save.error.message : "Unexpected error."}
            </SectionMessage>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Button variant="primary" isLoading={save.isPending}
              disabled={!dirty || Object.keys(problems).length > 0}
              onClick={() => save.mutate(current)}>
              <Save /> Save details
            </Button>
            {dirty && (
              <Button variant="subtle" disabled={save.isPending} onClick={() => setRows(toRows(saved))}>
                Discard changes
              </Button>
            )}
            <span className="text-xs text-subtlest" aria-live="polite">
              {save.isPending ? "Saving…" : dirty ? "Unsaved changes" : save.isSuccess ? "Saved" : ""}
            </span>
          </div>
    </>
  );
}
