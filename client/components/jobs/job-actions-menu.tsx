"use client";

import { useState } from "react";
import { Archive, ExternalLink, Mail, MoreHorizontal } from "lucide-react";

import type { Job } from "@/lib/api/jobs";
import { safeUrl } from "@/lib/safe-url";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useUpdateJob } from "@/lib/jobs/use-jobs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

/** The ⋯ menu for a job (board card or list row): move to a status, write the email, open, archive. */
export function JobActionsMenu({ job, className }: { job: Job; className?: string }) {
  const updateJob = useUpdateJob();
  const [composeOpen, setComposeOpen] = useState(false);

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
        </DropdownMenuContent>
      </DropdownMenu>

      <ComposeEmailDialog job={job} open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}
