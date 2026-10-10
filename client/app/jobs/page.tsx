import type { Metadata } from "next";
import { Columns3, List } from "lucide-react";

import { JOB_STATUSES } from "@/lib/jobs/statuses";
import { Board, BoardColumn } from "@/components/ui/board";
import { PageHeader } from "@/components/ui/page-header";
import { SectionMessage } from "@/components/ui/section-message";
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

      <SectionMessage className="mb-5" title="Job tracking is being built">
        Next step: add jobs and move them across these columns as your applications progress.
      </SectionMessage>

      <Board>
        {JOB_STATUSES.map((status) => (
          <BoardColumn key={status.id} title={status.label} count={0} empty="No jobs" />
        ))}
      </Board>
    </>
  );
}
