import { Suspense } from "react";
import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { ResumeEditor } from "@/components/resumes/resume-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Resume editor",
};

/** /dashboard/resumes/new starts a resume; /dashboard/resumes/<id> edits a saved one. */
export default function ResumeEditorPage({ params }: PageProps<"/dashboard/resumes/[resumeId]">) {
  return (
    <>
      <PageHeader
        title="Resume editor"
        breadcrumbs={[
          { label: "CareerPilot", href: ROUTES.dashboard },
          { label: "Resumes", href: ROUTES.resumes },
          { label: "Editor" },
        ]}
      />
      {/* With cacheComponents, route params are request data and must be read inside Suspense */}
      <Suspense
        fallback={
          <div className="flex items-center gap-2 py-10 text-subtle">
            <Spinner /> Opening the editor…
          </div>
        }
      >
        {params.then(({ resumeId }) => (
          <ResumeEditor resumeId={resumeId === "new" ? null : decodeURIComponent(resumeId)} />
        ))}
      </Suspense>
    </>
  );
}
