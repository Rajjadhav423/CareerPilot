"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { ResumeSummary } from "@/lib/api/resumes";
import { formatRelativeTime } from "@/lib/format";
import { useDeleteResume, useResumeTemplates, useResumes } from "@/lib/resumes/use-resumes";
import { resumePath, ROUTES } from "@/lib/routes";
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

export function ResumeList() {
  const { data: resumes, isPending, error } = useResumes();
  const templates = useResumeTemplates();
  const remove = useDeleteResume();
  const [deleting, setDeleting] = useState<ResumeSummary | null>(null);

  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your resumes">
        {error instanceof ApiError ? error.message : "Unexpected error."}
      </SectionMessage>
    );
  }
  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your resumes…
      </div>
    );
  }

  const templateName = (id: string) => templates.data?.find((t) => t.id === id)?.name ?? id;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle">
          {resumes.length === 0 ? "No resumes yet" : `${resumes.length} ${resumes.length === 1 ? "resume" : "resumes"}`}
        </p>
        <Button asChild variant="primary">
          <Link href={ROUTES.resumeNew}>
            <Plus /> New resume
          </Link>
        </Button>
      </div>

      {resumes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Create your first resume"
            description="Fill in your details once, pick a template, and download an ATS-friendly PDF or save it to Google Drive."
            actions={
              <Button asChild variant="primary">
                <Link href={ROUTES.resumeNew}>
                  <Plus /> New resume
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {resumes.map((resume) => (
            <li key={resume.id} className="min-w-0">
              <Card className="h-full gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={resumePath(resume.id)}
                      className="rounded-xs font-semibold break-words text-foreground outline-none hover:text-link hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {resume.title}
                    </Link>
                    {resume.fullName && <p className="truncate text-sm text-subtle">{resume.fullName}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="subtle" size="icon-compact" aria-label={`Actions for ${resume.title}`} className="-mt-0.5 -mr-1">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-44">
                      <DropdownMenuItem asChild>
                        <Link href={resumePath(resume.id)}>
                          <Pencil /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDeleting(resume)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Lozenge>{templateName(resume.templateId)}</Lozenge>
                  <Lozenge>{resume.pageSize === "LETTER" ? "Letter" : "A4"}</Lozenge>
                  {resume.pendingProposals > 0 && (
                    <Lozenge appearance="new">
                      {resume.pendingProposals} {resume.pendingProposals === 1 ? "suggestion" : "suggestions"} to review
                    </Lozenge>
                  )}
                  <span className="text-xs text-subtlest">Updated {formatRelativeTime(resume.updatedAt)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            remove.reset();
          }
        }}
        appearance="danger"
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="The resume is removed from CareerPilot. PDFs you already saved to Google Drive stay in your Drive."
        confirmLabel="Delete"
        isLoading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      >
        {remove.error && (
          <SectionMessage appearance="error" title="Couldn't delete the resume">
            {remove.error instanceof ApiError ? remove.error.message : "Unexpected error."}
          </SectionMessage>
        )}
      </ConfirmDialog>
    </>
  );
}
