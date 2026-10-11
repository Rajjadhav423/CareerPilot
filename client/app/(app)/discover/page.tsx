import type { Metadata } from "next";

import { JobSearch } from "@/components/discover/job-search";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Find jobs",
};

export default function FindJobsPage() {
  return (
    <>
      <PageHeader
        title="Find jobs"
        breadcrumbs={[{ label: "CareerPilot", href: "/" }, { label: "Find jobs" }]}
        description="Live tech openings from company career boards (Greenhouse, Lever, Ashby). Non-tech roles are filtered out. Refreshed every 15 minutes."
      />
      <JobSearch />
    </>
  );
}
