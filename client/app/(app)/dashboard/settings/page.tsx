import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { ResumeDetailsSettings } from "@/components/settings/resume-details-settings";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Details you reuse in every resume, and your accent colour."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Settings" }]}
      />
      <div className="@container flex max-w-4xl flex-col gap-6">
        <ResumeDetailsSettings />
        <AppearanceSettings />
      </div>
    </>
  );
}
