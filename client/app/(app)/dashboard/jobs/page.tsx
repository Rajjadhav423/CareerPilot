import type { Metadata } from "next";
import { Columns3, List, Mail } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { JobBoard } from "@/components/jobs/job-board";
import { ReplyTrackingNotice } from "@/components/jobs/job-email-status";
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
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Jobs" }]}
      />

      <Tabs className="mb-5">
        <Tab href={ROUTES.jobs} active icon={<Columns3 />}>
          Board
        </Tab>
        <Tab href={ROUTES.jobsList} icon={<List />}>
          List
        </Tab>
        <Tab href={ROUTES.jobsEmails} icon={<Mail />}>
          Emails
        </Tab>
      </Tabs>

      <ReplyTrackingNotice className="mb-4" />
      <JobBoard />
    </>
  );
}
