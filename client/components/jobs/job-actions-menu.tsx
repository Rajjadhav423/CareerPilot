"use client";

import { useState } from "react";
import { Archive, ExternalLink, Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Job } from "@/lib/api/jobs";
import { safeUrl } from "@/lib/safe-url";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useDeleteJob, useUpdateJob } from "@/lib/jobs/use-jobs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionMessage } from "@/components/ui/section-message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposeEmailDialog } from "@/components/applications/compose-email-dialog";
import { AddJobDialog } from "./add-job-dialog";

/** The ⋯ menu for a job (board card or list row): move to a status, edit, write the email, open, archive, delete. */
export function JobActionsMenu({ job, className }: { job: Job; className?: string }) {
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [composeOpen, setComposeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon-compact" aria-label={`Actions for ${job.title}`} className={cn(className)}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={job.status}
            onValueChange={(status) => updateJob.mutate({ id: job.id, input: { status: status as JobStatus } })}
          >
            {JOB_STATUSES.map((status) => (
              <DropdownMenuRadioItem key={status.id} value={status.id}>
                {status.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit job
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setComposeOpen(true)}>
            <Mail />
            Write application email
          </DropdownMenuItem>
          {safeUrl(job.jobUrl) && (
            <DropdownMenuItem asChild>
              <a href={safeUrl(job.jobUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Open job posting
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => updateJob.mutate({ id: job.id, input: { archived: true } })}>
            <Archive />
            Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger-text" onSelect={() => { deleteJob.reset(); setDeleteOpen(true); }}>
            <Trash2 />
            Delete job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ComposeEmailDialog job={job} open={composeOpen} onOpenChange={setComposeOpen} />
      {/* Mounted only while open, so the form starts from the job's latest details */}
      {editOpen && <AddJobDialog job={job} open onOpenChange={setEditOpen} />}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${job.title}”?`}
        description="It's removed from your board for good, with its notes and description. Emails you already sent stay in your Emails history. To keep it out of the way instead, use Archive."
        confirmLabel="Delete job"
        cancelLabel="Keep it"
        appearance="danger"
        isLoading={deleteJob.isPending}
        onConfirm={() => deleteJob.mutate(job.id, { onSuccess: () => setDeleteOpen(false) })}
      >
        {deleteJob.error && (
          <SectionMessage appearance="error" title="Not deleted">
            {deleteJob.error instanceof ApiError ? deleteJob.error.message : "Unexpected error."}
          </SectionMessage>
        )}
      </ConfirmDialog>
    </>
  );
}
