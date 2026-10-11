"use client";

import { useState } from "react";
import { Archive, ExternalLink, Mail, MoreHorizontal } from "lucide-react";

import type { Job } from "@/lib/api/jobs";
import { formatRelativeTime } from "@/lib/format";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useUpdateJob } from "@/lib/jobs/use-jobs";
import { BoardCard } from "@/components/ui/board";
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
import { Lozenge } from "@/components/ui/lozenge";
import { ComposeEmailDialog } from "@/components/applications/compose-email-dialog";

const workModeLabel = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" } as const;

/** A job on the board. The ⋯ menu moves it between columns (works with touch, unlike drag and drop). */
export function JobCard({ job }: { job: Job }) {
  const updateJob = useUpdateJob();
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <BoardCard className="gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {job.jobUrl ? (
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium break-words text-foreground hover:text-link hover:underline"
            >
              {job.title}
            </a>
          ) : (
            <p className="font-medium break-words">{job.title}</p>
          )}
          <p className="truncate text-subtle">
            {job.company}
            {job.location && ` · ${job.location}`}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="subtle" size="icon-compact" aria-label={`Actions for ${job.title}`} className="-mt-0.5 -mr-1">
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
            {job.jobUrl && (
              <DropdownMenuItem asChild>
                <a href={job.jobUrl} target="_blank" rel="noopener noreferrer">
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
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {job.workMode && <Lozenge appearance={job.workMode === "REMOTE" ? "new" : "default"}>{workModeLabel[job.workMode]}</Lozenge>}
        <span className="text-xs text-subtlest">
          {job.source === "MANUAL" ? "Added" : `From ${job.source.charAt(0)}${job.source.slice(1).toLowerCase()}`}{" "}
          {formatRelativeTime(job.createdAt)}
        </span>
        {job.appliedAt && (
          <span className="text-xs text-subtlest">· Emailed {formatRelativeTime(job.appliedAt)}</span>
        )}
      </div>

      <ComposeEmailDialog job={job} open={composeOpen} onOpenChange={setComposeOpen} />
    </BoardCard>
  );
}
