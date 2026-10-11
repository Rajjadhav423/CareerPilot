import type { Metadata } from "next";
import { Columns3, List } from "lucide-react";

import { JobBoard } from "@/components/jobs/job-board";
import { PageHeader } from "@/components/ui/page-header";
import { Tab, Tabs } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Job board",
};

export default function JobBoardPage() {
  return (
    <>
      <PageHeader
        className="mb-2"
        title="Job board"
        breadcrumbs={[{ label: "CareerPilot", href: "/" }, { label: "Jobs" }]}
      />

      <Tabs className="mb-5">
        <Tab href="/jobs" active icon={<Columns3 />}>
          Board
        </Tab>
        <Tab href="/jobs/list" disabled icon={<List />}>
          List
        </Tab>
      </Tabs>

      <JobBoard />
    </>
  );
}
