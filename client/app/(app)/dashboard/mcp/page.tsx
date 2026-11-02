import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { McpInstallGuide } from "@/components/mcp/mcp-install-guide";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "MCP plugin",
};

export default function McpPage() {
  return (
    <>
      <PageHeader
        title="MCP plugin"
        description="Use CareerPilot inside your AI assistant. Search jobs, tailor resumes and send applications without leaving the chat."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "MCP plugin" }]}
      />
      <div className="@container flex max-w-4xl flex-col gap-6">
        <McpInstallGuide />
      </div>
    </>
  );
}
