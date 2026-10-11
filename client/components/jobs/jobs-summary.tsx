"use client";

import Link from "next/link";
import { Briefcase, Search } from "lucide-react";

import { JOB_STATUSES } from "@/lib/jobs/statuses";
import { useJobs } from "@/lib/jobs/use-jobs";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Lozenge } from "@/components/ui/lozenge";
import { Spinner } from "@/components/ui/spinner";

/** Dashboard card: how many jobs sit in each board column. */
export function JobsSummary() {
  const { data: jobs, isPending, isError } = useJobs();

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Your pipeline</CardTitle>
        {jobs && jobs.length > 0 && (
          <Button asChild size="compact" variant="link">
            <Link href={ROUTES.jobs}>Open job board</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isPending && (
          <p className="flex items-center gap-2 text-subtle">
            <Spinner size="sm" /> Loading…
          </p>
        )}

        {isError && <p className="text-sm text-danger-text">Couldn&apos;t load your jobs.</p>}

        {jobs && jobs.length === 0 && (
          <EmptyState
            icon={<Briefcase />}
            title="No jobs tracked yet"
            description="Save openings from Find jobs or add your own, then move them from Saved to Applied to Offer."
            actions={
              <Button asChild variant="primary">
                <Link href={ROUTES.discover}>
                  <Search /> Find jobs
                </Link>
              </Button>
            }
          />
        )}

        {jobs && jobs.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {JOB_STATUSES.map((status) => {
              const count = jobs.filter((job) => job.status === status.id).length;
              return (
                <li key={status.id} className="rounded-md bg-surface-sunken p-3">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{count}</p>
                  <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
