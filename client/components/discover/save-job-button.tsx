"use client";

import Link from "next/link";
import { BookmarkPlus, Check } from "lucide-react";

import type { JobPosting } from "@/lib/api/discover";
import type { CreateJobInput } from "@/lib/api/jobs";
import { useCreateJob, useJobs } from "@/lib/jobs/use-jobs";
import { Button } from "@/components/ui/button";

function toJobInput(posting: JobPosting): CreateJobInput {
  return {
    title: posting.title,
    company: posting.company,
    location: posting.location,
    workMode: posting.workplaceType === "UNSPECIFIED" ? null : posting.workplaceType,
    jobUrl: posting.url,
    source: posting.source.toUpperCase(),
    externalId: posting.id,
  };
}

/** Saves a Find-jobs posting to the board's "Saved" column; shows "Saved" (link to the board) afterwards. */
export function SaveJobButton({ posting }: { posting: JobPosting }) {
  const { data: jobs } = useJobs();
  const saveJob = useCreateJob();
  const saved = saveJob.isSuccess || (jobs?.some((job) => job.externalId === posting.id) ?? false);

  if (saved) {
    return (
      <Button asChild size="compact" isSelected>
        <Link href="/jobs" title="On your job board">
          <Check /> Saved
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="compact"
      isLoading={saveJob.isPending}
      onClick={() => saveJob.mutate(toJobInput(posting))}
      title={saveJob.isError ? "Couldn't save. Try again." : "Save to your job board"}
    >
      <BookmarkPlus /> {saveJob.isError ? "Retry" : "Save"}
    </Button>
  );
}
