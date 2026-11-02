import type { Metadata } from "next";
import { Columns3, List, Mail } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { ScheduledEmailList } from "@/components/jobs/scheduled-email-list";
import { SentEmailList } from "@/components/jobs/sent-email-list";
import { ReplyTrackingNotice } from "@/components/jobs/job-email-status";
import { PageHeader } from "@/components/ui/page-header";
import { StickyHeader } from "@/components/ui/sticky-header";
import { Tab, Tabs } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Sent emails",
};

export default function JobEmailsPage() {
  return (
    <>
      {/* Breadcrumbs, title and tabs stay put while the board scrolls */}
      <StickyHeader className="mb-5">
        <PageHeader
          className="mb-2"
          title="Job board"
          breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Jobs" }]}
        />

        <Tabs>
          <Tab href={ROUTES.jobs} icon={<Columns3 />}>
            Board
          </Tab>
          <Tab href={ROUTES.jobsList} icon={<List />}>
            List
          </Tab>
          <Tab href={ROUTES.jobsEmails} active icon={<Mail />}>
            Emails
          </Tab>
        </Tabs>
      </StickyHeader>

      <ReplyTrackingNotice className="mb-4" />
      <ScheduledEmailList className="mb-6" />
      <SentEmailList />
    </>
  );
}
