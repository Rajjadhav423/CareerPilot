import { Suspense } from "react";
import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { DriveConnectionCard } from "@/components/drive/drive-connection-card";
import { DriveDocuments } from "@/components/drive/drive-documents";
import { DriveResultMessage } from "@/components/drive/drive-result-message";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Documents",
};

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="PDFs you saved to Google Drive from CareerPilot."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Documents" }]}
      />
      <div className="@container flex flex-col gap-4">
        {/* Reads ?drive=… after Google's consent screen */}
        <Suspense fallback={null}>
          <DriveResultMessage />
        </Suspense>
        <DriveConnectionCard />
        <DriveDocuments />
      </div>
    </>
  );
}
