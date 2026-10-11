"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, Search } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Job } from "@/lib/api/jobs";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useJobs } from "@/lib/jobs/use-jobs";
import { Board, BoardColumn } from "@/components/ui/board";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { AddJobDialog } from "./add-job-dialog";
import { JobCard } from "./job-card";

function groupByStatus(jobs: Job[]) {
  const groups = Object.fromEntries(JOB_STATUSES.map((s) => [s.id, [] as Job[]])) as Record<JobStatus, Job[]>;
  for (const job of jobs) groups[job.status]?.push(job);
  return groups;
}

export function JobBoard() {
  const { data: jobs, isPending, error } = useJobs();
  const [addOpen, setAddOpen] = useState(false);

  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your jobs">
        {error instanceof ApiError ? error.message : "Unexpected error."}
      </SectionMessage>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your board…
      </div>
    );
  }

  const groups = groupByStatus(jobs);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle">
          {jobs.length === 0 ? "No jobs yet" : `${jobs.length} active ${jobs.length === 1 ? "job" : "jobs"}`}
        </p>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus /> Add job
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="Your board is empty"
          description="Save openings from Find jobs, or add one you found elsewhere. Then move them along as your applications progress."
          actions={
            <>
              <Button asChild variant="primary">
                <Link href="/discover">
                  <Search /> Find jobs
                </Link>
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add job
              </Button>
            </>
          }
        />
      ) : (
        <Board>
          {JOB_STATUSES.map((status) => (
            <BoardColumn key={status.id} title={status.label} count={groups[status.id].length} empty="No jobs">
              {groups[status.id].length > 0
                ? groups[status.id].map((job) => <JobCard key={job.id} job={job} />)
                : undefined}
            </BoardColumn>
          ))}
        </Board>
      )}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
