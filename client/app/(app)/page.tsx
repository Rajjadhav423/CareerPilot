import type { Metadata } from "next";

import { BackendStatus } from "@/components/health/backend-status";
import { JobsSummary } from "@/components/jobs/jobs-summary";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: "CareerPilot", href: "/" }, { label: "Dashboard" }]}
        description="Your job search at a glance."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <JobsSummary />
        <BackendStatus />
      </div>
    </div>
  );
}
