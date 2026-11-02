"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Check, Mail } from "lucide-react";

import type { JobPosting } from "@/lib/api/discover";
import type { CreateJobInput, Job } from "@/lib/api/jobs";
import { useCreateJob, useJobs } from "@/lib/jobs/use-jobs";
import { ROUTES } from "@/lib/routes";
import { ComposeEmailDialog } from "@/components/applications/compose-email-dialog";
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
    // Read back by contactEmailOf() when composing the application email
    notes: posting.contactEmail ? `HR email: ${posting.contactEmail}` : null,
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
        <Link href={ROUTES.jobs} title="On your job board">
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

/**
 * For postings that give an HR email: saves the job (if it isn't on the board yet) and opens the application
 * email to that address. Renders nothing when the post has no email.
 */
export function EmailHrButton({ posting }: { posting: JobPosting }) {
  const { data: jobs } = useJobs();
  const saveJob = useCreateJob();
  const [job, setJob] = useState<Job | null>(null);
  if (!posting.contactEmail) return null;

  async function open() {
    const existing = jobs?.find((saved) => saved.externalId === posting.id);
    try {
      setJob(existing ?? (await saveJob.mutateAsync(toJobInput(posting))));
    } catch {
      // The button shows "Retry"
    }
  }

  return (
    <>
      <Button
        size="compact"
        variant="primary"
        isLoading={saveJob.isPending}
        onClick={open}
        title={saveJob.isError ? "Couldn't save the job. Try again." : `Save and email ${posting.contactEmail}`}
      >
        <Mail /> {saveJob.isError ? "Retry" : "Email HR"}
      </Button>
      {job && (
        <ComposeEmailDialog
          job={job}
          open
          onOpenChange={(next) => !next && setJob(null)}
          initialTo={posting.contactEmail}
        />
      )}
    </>
  );
}
