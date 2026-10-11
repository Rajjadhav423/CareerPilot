import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { TemplateList } from "@/components/templates/template-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Email templates",
};

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Email templates"
        description="Reusable application emails. Write one from any job on your board; you review every email before it's sent."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Email templates" }]}
      />

      <div className="@container flex flex-col gap-6">
        <GmailConnectionCard />
        <section aria-label="Templates">
          <TemplateList />
        </section>
      </div>
    </>
  );
}
