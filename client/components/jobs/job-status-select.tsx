"use client";

import { ChevronDown } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import type { Job } from "@/lib/api/jobs";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useUpdateJob } from "@/lib/jobs/use-jobs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Lozenge, lozengeVariants } from "@/components/ui/lozenge";

/** Jira's status button in the List view: the status lozenge with a chevron; picking a status moves the job. */
export function JobStatusSelect({ job }: { job: Job }) {
  const updateJob = useUpdateJob();
  const current = JOB_STATUSES.find((status) => status.id === job.status) ?? JOB_STATUSES[0];

  return (
    <DropdownMenu>
      <DropdownMenuPrimitive.Trigger
        aria-label={`Status: ${current.label}. Change status`}
        className={cn(
          lozengeVariants({ appearance: current.appearance }),
          "h-6 cursor-pointer gap-0.5 rounded-sm px-1.5 outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:h-8",
        )}
      >
        {current.label}
        <ChevronDown className="size-3.5" aria-hidden />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup
          value={job.status}
          onValueChange={(status) => updateJob.mutate({ id: job.id, input: { status: status as JobStatus } })}
        >
          {JOB_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status.id} value={status.id}>
              <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
