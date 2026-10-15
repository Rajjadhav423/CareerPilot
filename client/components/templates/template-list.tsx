"use client";

import { useState } from "react";
import { Copy, FileText, MoreHorizontal, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { EmailTemplate } from "@/lib/api/templates";
import { STARTER_TEMPLATES } from "@/lib/email/starter-templates";
import { formatRelativeTime } from "@/lib/format";
import { useDeleteTemplate, useDuplicateTemplate, useSaveTemplate, useTemplates } from "@/lib/email/use-templates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TemplateEditorDialog } from "./template-editor-dialog";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Unexpected error.";
}

/** The user's templates with create, edit, duplicate, make-default and delete. */
export function TemplateList() {
  const { data: templates, isPending, error } = useTemplates();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const duplicate = useDuplicateTemplate();
  const makeDefault = useSaveTemplate();
  const remove = useDeleteTemplate();

  function openEditor(template: EmailTemplate | null) {
    setEditing(template);
    setEditorOpen(true);
  }

  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your templates">
        {errorMessage(error)}
      </SectionMessage>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your templates…
      </div>
    );
  }

  const actionError = duplicate.error ?? makeDefault.error;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle">
          {templates.length === 0
            ? "No templates yet"
            : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
        </p>
        <Button variant="primary" onClick={() => openEditor(null)}>
          <Plus /> New template
        </Button>
      </div>

      {actionError && (
        <SectionMessage appearance="error" title="That didn't work" className="mb-4">
          {errorMessage(actionError)}
        </SectionMessage>
      )}

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Write your first template"
            description="Save the emails you send again and again. Fields like {{job_title}} and {{company_name}} are filled in for each job. Start with three professional emails, or write your own."
            actions={
              <>
                <StarterTemplatesButton />
                <Button onClick={() => openEditor(null)}>
                  <Plus /> New template
                </Button>
              </>
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {templates.map((template) => (
            <li key={template.id} className="min-w-0">
              <Card className="h-full gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditor(template)}
                        className="rounded-xs text-left font-semibold break-words text-foreground outline-none hover:text-link hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {template.name}
                      </button>
                      {template.isDefault && <Lozenge appearance="inprogress">Default</Lozenge>}
                    </div>
                    <p className="truncate text-sm text-subtle">{template.subject}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="subtle" size="icon-compact" aria-label={`Actions for ${template.name}`} className="-mt-0.5 -mr-1">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52">
                      <DropdownMenuItem onSelect={() => openEditor(template)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicate.mutate(template.id)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      {!template.isDefault && (
                        <DropdownMenuItem
                          onSelect={() =>
                            makeDefault.mutate({
                              id: template.id,
                              input: { name: template.name, subject: template.subject, body: template.body, isDefault: true },
                            })
                          }
                        >
                          <Star /> Make default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDeleting(template)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="line-clamp-3 text-sm break-words whitespace-pre-line text-subtle">{template.body}</p>
                <p className="mt-auto text-xs text-subtlest">Updated {formatRelativeTime(template.updatedAt)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <TemplateEditorDialog open={editorOpen} onOpenChange={setEditorOpen} template={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            remove.reset();
          }
        }}
        appearance="danger"
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="The template is removed for good. Emails you already sent with it aren't affected."
        confirmLabel="Delete"
        isLoading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              remove.reset();
            },
          })
        }
      >
        {remove.error && (
          <SectionMessage appearance="error" title="Couldn't delete the template">
            {errorMessage(remove.error)}
          </SectionMessage>
        )}
      </ConfirmDialog>
    </>
  );
}

/** Adds the professional starter emails (application, recruiter outreach, follow-up); the first is the default. */
function StarterTemplatesButton() {
  const save = useSaveTemplate();
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function addAll() {
    setAdding(true);
    setFailed(null);
    try {
      for (const [i, t] of STARTER_TEMPLATES.entries()) {
        await save.mutateAsync({ input: { name: t.name, subject: t.subject, body: t.body, isDefault: i === 0 } });
      }
    } catch (error) {
      setFailed(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  return (
    <span className="flex flex-col items-center gap-1">
      <Button variant="primary" isLoading={adding} onClick={() => void addAll()}>
        <Sparkles /> Add starter templates
      </Button>
      {failed && <span className="text-xs text-danger-text" role="alert">{failed}</span>}
    </span>
  );
}
