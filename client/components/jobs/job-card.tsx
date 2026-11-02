"use client";

import type { Job } from "@/lib/api/jobs";
import { safeUrl } from "@/lib/safe-url";
import { formatRelativeTime } from "@/lib/format";
import { BoardCard } from "@/components/ui/board";
import { Lozenge } from "@/components/ui/lozenge";
import { JobActionsMenu } from "./job-actions-menu";
import { JobEmailStatus } from "./job-email-status";

export const workModeLabel = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" } as const;

/** A job on the board. The ⋯ menu moves it between columns (works with touch, unlike drag and drop). */
export function JobCard({ job }: { job: Job }) {
  return (
    <BoardCard className="gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {safeUrl(job.jobUrl) ? (
            <a
              href={safeUrl(job.jobUrl) ?? undefined}
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

        <JobActionsMenu job={job} className="-mt-0.5 -mr-1" />
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
        <JobEmailStatus jobId={job.id} />
      </div>

    </BoardCard>
  );
}
