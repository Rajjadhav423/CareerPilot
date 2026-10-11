import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";

import { BackendStatus } from "@/components/health/backend-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Lozenge } from "@/components/ui/lozenge";
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <Lozenge appearance="new">Phase 1</Lozenge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Briefcase />}
              title="No jobs tracked yet"
              description="Job tracking is the next feature. You'll be able to add jobs manually and move them from Saved to Applied to Offer."
              actions={
                <Button asChild>
                  <Link href="/jobs">Open job board</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>

        <BackendStatus />
      </div>
    </div>
  );
}
