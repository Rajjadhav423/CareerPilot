"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";

const MCP_URL = "https://careerpilot-mcp.onrender.com/mcp";

// Install links carry the server config encoded the way each editor expects.
const CURSOR_LINK = `https://cursor.com/install-mcp?name=careerpilot&config=${btoa(JSON.stringify({ url: MCP_URL }))}`;
const VSCODE_LINK = `https://insiders.vscode.dev/redirect/mcp/install?name=careerpilot&config=${encodeURIComponent(
  JSON.stringify({ name: "careerpilot", type: "http", url: MCP_URL }),
)}`;

type Client = {
  id: string;
  name: string;
  method: "Paste URL" | "One command" | "One click";
  summary: string;
  requirement?: string;
  steps: React.ReactNode[];
  command?: string;
  link?: { label: string; href: string };
};

const clients: Client[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    method: "Paste URL",
    summary: "Add CareerPilot as a plugin in ChatGPT on the web.",
    link: { label: "Open ChatGPT Plugins", href: "https://chatgpt.com/plugins" },
    requirement:
      "Requires a paid ChatGPT plan. On Business and Enterprise workspaces, an admin may need to grant the “Create plugins with MCPs” permission.",
    steps: [
      <>Open <b>Plugins</b> in the ChatGPT sidebar, select <b>Add</b> and choose <b>Add custom MCP server</b>.</>,
      <>Enter <b>CareerPilot</b> as the name and paste the server URL under <b>Connection</b>.</>,
      <>Set authentication to <b>OAuth</b>, review the warning and select <b>Create</b>.</>,
      <>Sign in with your CareerPilot account and review the tools ChatGPT discovers.</>,
      <>Start a new chat and select CareerPilot from the <b>+</b> menu.</>,
    ],
  },
  {
    id: "claude",
    name: "Claude",
    method: "Paste URL",
    summary: "Add CareerPilot as a custom connector on claude.ai or Claude Desktop.",
    link: { label: "Open Claude Connectors", href: "https://claude.ai/settings/connectors" },
    requirement:
      "Available on all plans; the Free plan allows one custom connector. On Team and Enterprise, an organization owner adds the connector first, then each member connects.",
    steps: [
      <>Go to <b>Settings → Connectors</b>, scroll to the bottom and select <b>Add custom connector</b>.</>,
      <>Enter <b>CareerPilot</b> as the name, paste the server URL and select <b>Add</b>.</>,
      <>Select <b>Connect</b> and sign in with your CareerPilot account.</>,
      <>Enable CareerPilot from the tools menu in any chat.</>,
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    method: "One command",
    summary: "Register CareerPilot with Claude Code from your terminal.",
    link: { label: "Claude Code MCP docs", href: "https://docs.claude.com/en/docs/claude-code/mcp" },
    steps: [
      <>Run the command below in your terminal.</>,
      <>Start Claude Code, type <b>/mcp</b> and sign in with your CareerPilot account.</>,
    ],
    command: `claude mcp add --transport http careerpilot ${MCP_URL}`,
  },
  {
    id: "gemini",
    name: "Gemini",
    method: "Paste URL",
    summary: "Add CareerPilot as a custom connected app in Gemini on the web.",
    link: { label: "Open Gemini Connected Apps", href: "https://gemini.google.com/customize/connectors" },
    requirement: "Custom apps need a paid Google AI plan and Gemini Apps Activity turned on.",
    steps: [
      <>Open <b>gemini.google.com/customize/connectors</b> (or <b>Settings → Connected Apps</b>).</>,
      <>Select <b>+ Custom</b>, enter <b>CareerPilot</b> as the name and paste the server URL.</>,
      <>Sign in with your CareerPilot account to approve access.</>,
      <>CareerPilot now appears under <b>Installed</b>. Ask Gemini to use it in any chat.</>,
    ],
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    method: "One command",
    summary: "Register CareerPilot with Gemini CLI from your terminal.",
    link: { label: "Gemini CLI MCP docs", href: "https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html" },
    requirement: "The Gemini web and mobile apps do not support custom connectors yet.",
    steps: [
      <>Run the command below in your terminal.</>,
      <>Start Gemini CLI, type <b>/mcp auth careerpilot</b> and sign in with your CareerPilot account.</>,
    ],
    command: `gemini mcp add --transport http careerpilot ${MCP_URL}`,
  },
  {
    id: "vscode",
    name: "VS Code",
    method: "One click",
    summary: "Install CareerPilot for GitHub Copilot agent mode in VS Code.",
    steps: [
      <>Select <b>Add to VS Code</b> and confirm the install.</>,
      <>Sign in with your CareerPilot account when prompted.</>,
    ],
    link: { label: "Add to VS Code", href: VSCODE_LINK },
  },
  {
    id: "cursor",
    name: "Cursor",
    method: "One click",
    summary: "Install CareerPilot in Cursor.",
    steps: [
      <>Select <b>Add to Cursor</b> and confirm the install.</>,
      <>Sign in with your CareerPilot account when prompted.</>,
    ],
    link: { label: "Add to Cursor", href: CURSOR_LINK },
  },
];

/** Assistant picker with install steps for the selected one, plus the shared server URL. */
export function McpInstallGuide() {
  const [selectedId, setSelectedId] = useState(clients[0].id);
  const client = clients.find((c) => c.id === selectedId) ?? clients[0];

  return (
    <>
      <div role="tablist" aria-label="AI assistant" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {clients.map((c) => (
          <Button
            key={c.id}
            role="tab"
            aria-selected={c.id === selectedId}
            isSelected={c.id === selectedId}
            onClick={() => setSelectedId(c.id)}
            className="shrink-0"
          >
            {c.name}
          </Button>
        ))}
      </div>

      <Card role="tabpanel">
        <CardHeader className="flex-col-reverse sm:flex-row">
          <div className="min-w-0">
            <CardTitle>Connect to {client.name}</CardTitle>
            <CardDescription>{client.summary}</CardDescription>
          </div>
          <Lozenge appearance={client.method === "Paste URL" ? "default" : "success"}>{client.method}</Lozenge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {client.method === "Paste URL" && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Server URL</p>
              <CopyField value={MCP_URL} />
            </div>
          )}
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {client.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {client.command && <CopyField value={client.command} />}
          {client.link && (
            <a
              href={client.link.href}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "primary" }), "w-full sm:w-auto sm:self-start")}
            >
              {client.link.label}
              <ExternalLink aria-hidden />
            </a>
          )}
          {client.requirement && <p className="text-sm text-subtle">{client.requirement}</p>}
        </CardContent>
      </Card>

      <p className="text-sm text-subtle">
        Using another assistant? Any app that supports remote MCP servers with OAuth can connect using{" "}
        <code className="font-mono break-all">{MCP_URL}</code>.
      </p>
    </>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-start gap-2 rounded-sm border border-border bg-neutral py-1 pr-1 pl-2">
      <code className="min-w-0 flex-1 py-1.5 font-mono text-sm break-all">{value}</code>
      <Button variant="subtle" size="icon" onClick={copy} className="shrink-0" aria-label={copied ? "Copied" : "Copy"}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </div>
  );
}
