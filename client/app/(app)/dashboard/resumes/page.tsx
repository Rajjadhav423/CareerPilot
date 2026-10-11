import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { ResumeList } from "@/components/resumes/resume-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Resumes",
};

export default function ResumesPage() {
  return (
    <>
      <PageHeader
        title="Resumes"
        description="Write your resume once, pick a template, and create ATS-friendly PDFs."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Resumes" }]}
      />
      <div className="@container">
        <ResumeList />
      </div>
    </>
  );
}
