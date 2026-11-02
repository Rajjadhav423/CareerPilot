import {
  Bot,
  Briefcase,
  Check,
  FileText,
  LayoutDashboard,
  Mail,
  MapPin,
  Search,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Lozenge } from "@/components/ui/lozenge";

/*
 * Static illustrations for the home page, drawn with the app's tokens and lozenges (light and dark). Example data
 * only, hidden from screen readers: the text next to each one says what it shows.
 */

/** A rounded app window with traffic lights and a title. */
function Window({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className={cn("pointer-events-none overflow-hidden rounded-xl border border-border bg-surface shadow-overlay select-none", className)}>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-sunken px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-danger-bold/70" />
        <span className="size-2.5 rounded-full bg-warning-bold/70" />
        <span className="size-2.5 rounded-full bg-success-bold/70" />
        <span className="mx-auto pr-10 text-xs text-subtlest">{title}</span>
      </div>
      {children}
    </div>
  );
}

const scoreAppearance = (score: number) => (score >= 70 ? "success" : score >= 40 ? "moved" : "default");

const heroJobs = [
  { title: "Senior Backend Engineer", company: "Northwind Labs", place: "Remote", score: 92, email: true, skills: "Node.js · TypeScript · AWS" },
  { title: "Full Stack Developer", company: "Acme Payments", place: "Bengaluru", score: 78, email: true, skills: "React · Node.js · PostgreSQL" },
  { title: "Software Engineer II", company: "Globex", place: "Berlin", score: 64, email: false, skills: "Java · Spring Boot" },
  { title: "Platform Engineer", company: "Initech Cloud", place: "Tokyo", score: 41, email: false, skills: "Docker · Kubernetes" },
];

/** The hero's wide app window: sidebar, search and job results sorted by match. */
export function AppWindow() {
  return (
    <Window title="careerpilot · Find jobs">
      <div className="flex">
        <nav className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border p-3 text-sm md:flex">
          {[
            { icon: LayoutDashboard, label: "Dashboard" },
            { icon: Search, label: "Find jobs", active: true },
            { icon: Briefcase, label: "My jobs" },
            { icon: FileText, label: "Resumes" },
            { icon: Mail, label: "Emails" },
          ].map(({ icon: Icon, label, active }) => (
            <span key={label} className={cn("flex items-center gap-2 rounded-sm px-2 py-1.5",
              active ? "bg-selected font-medium text-selected-text" : "text-subtle")}>
              <Icon className="size-4" /> {label}
            </span>
          ))}
        </nav>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm border border-border-input px-2.5 text-sm text-foreground">
              <Search className="size-4 shrink-0 text-subtlest" /> <span className="truncate">backend engineer</span>
            </span>
            <span className="hidden h-8 items-center rounded-sm border border-border px-2.5 text-sm text-foreground sm:flex">Match: My resume</span>
            <span className="flex h-8 items-center gap-1.5 rounded-sm bg-selected px-2.5 text-sm font-medium text-selected-text">
              <Mail className="size-3.5" /> Has HR email
            </span>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {heroJobs.map((job) => (
              <li key={job.title} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-link">{job.title}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-subtle">
                    {job.company} <MapPin className="size-3 shrink-0" /> {job.place}
                    <span className="hidden text-subtlest lg:inline">· {job.skills}</span>
                  </p>
                </div>
                <Lozenge appearance={scoreAppearance(job.score)} isBold={job.score >= 70}>{job.score}%</Lozenge>
                <span className={cn("hidden h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium sm:inline-flex",
                  job.email ? "bg-brand text-inverse" : "border border-border text-foreground")}>
                  {job.email ? <><Mail className="size-3.5" /> Email HR</> : "Save"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Window>
  );
}

/** A ring gauge for the match tile. */
export function MatchGauge({ score = 92 }: { score?: number }) {
  const circumference = 2 * Math.PI * 42;
  return (
    <div aria-hidden className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-neutral" />
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)} className="stroke-success-bold" />
        <text x="50" y="50" dy="0.35em" textAnchor="middle" className="rotate-90 fill-foreground text-[22px] font-semibold"
          style={{ transformOrigin: "50px 50px" }}>{score}%</text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {["Node.js", "TypeScript", "PostgreSQL", "AWS"].map((skill) => (
          <li key={skill} className="flex items-center gap-1.5 text-foreground"><Check className="size-3.5 text-success-text" /> {skill}</li>
        ))}
        <li className="flex items-center gap-1.5 text-subtlest"><span className="w-3.5 text-center">–</span> Kafka</li>
      </ul>
    </div>
  );
}

/** A job post with its hiring email picked out. */
export function EmailFinder() {
  return (
    <div aria-hidden className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-subtle select-none">
      …experience with Node.js and PostgreSQL. To apply, send your CV to{" "}
      <mark className="rounded-xs bg-selected px-1 font-medium text-selected-text">careers@northwind.dev</mark>{" "}
      with the role in the subject…
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs">
        <Mail className="size-3.5 text-link" /> <span className="text-foreground">HR email found</span>
        <Lozenge appearance="new">Ready to apply</Lozenge>
      </div>
    </div>
  );
}

/** The application email, ready to send from Gmail. */
export function GmailSend() {
  return (
    <div aria-hidden className="rounded-lg border border-border bg-surface p-4 text-sm select-none">
      <p className="truncate text-subtle"><span className="text-subtlest">To </span>careers@northwind.dev</p>
      <p className="mt-1 truncate font-medium text-foreground">Application: Senior Backend Engineer</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 truncate text-xs text-subtle"><FileText className="size-3.5" /> Resume.pdf</span>
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm bg-brand px-2.5 text-xs font-medium text-inverse">
          <Send className="size-3.5" /> Send
        </span>
      </div>
    </div>
  );
}

const timeline = [
  { day: "Day 0", text: "Application sent", tone: "text-link" },
  { day: "Day 1", text: "Opened", tone: "text-link" },
  { day: "Day 7", text: "No reply: follow up", tone: "text-warning-text" },
  { day: "Day 9", text: "HR replied", tone: "text-success-text" },
];

/** An application's email timeline. */
export function FollowUpTimeline() {
  return (
    <ol aria-hidden className="relative flex flex-col gap-3 pl-6 text-sm select-none">
      <span className="absolute top-1.5 bottom-1.5 left-1.75 w-px bg-border" />
      {timeline.map((step) => (
        <li key={step.day} className="relative">
          <span className={cn("absolute top-0.5 -left-6 flex size-4 items-center justify-center rounded-full bg-surface ring-2 ring-current", step.tone)}>
            <span className="size-1.5 rounded-full bg-current" />
          </span>
          <span className="text-xs text-subtlest">{step.day}</span>
          <p className="font-medium text-foreground">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A short chat with an AI assistant connected to CareerPilot. */
export function AssistantChat() {
  return (
    <div aria-hidden className="flex flex-col gap-2 text-sm select-none">
      <p className="ml-auto max-w-[85%] rounded-lg rounded-br-xs bg-brand px-3 py-2 text-inverse">
        Find remote backend jobs that match my resume
      </p>
      <div className="flex max-w-[90%] gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-discovery text-discovery-text"><Bot className="size-3.5" /></span>
        <p className="rounded-lg rounded-tl-xs border border-border bg-surface px-3 py-2 text-foreground">
          12 matches. The best is Northwind (92%). Shall I draft the email? I won&apos;t send it without your OK.
        </p>
      </div>
    </div>
  );
}

/** Two resume PDFs, original and tailored. */
export function ResumeStack() {
  return (
    <div aria-hidden className="relative h-32 select-none">
      {["Resume.pdf", "Resume - Northwind.pdf"].map((name, index) => (
        <div key={name} className={cn("absolute w-36 rounded-md border border-border bg-surface p-3 shadow-raised",
          index === 0 ? "top-0 left-0 -rotate-4" : "top-3 left-20 rotate-3")}>
          <div className="h-2 w-16 rounded-full bg-neutral-bold/60" />
          <div className="mt-2 flex flex-col gap-1">
            {[100, 85, 92, 70, 80].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-neutral" style={{ width: `${w}%` }} />)}
          </div>
          <p className="mt-2 truncate text-[10px] text-subtle">{name}</p>
        </div>
      ))}
    </div>
  );
}

const boardColumns = [
  { title: "Saved", tone: "bg-neutral-bold", count: 4 },
  { title: "Applied", tone: "bg-information-bold", count: 9 },
  { title: "Interview", tone: "bg-warning-bold", count: 2 },
  { title: "Offer", tone: "bg-success-bold", count: 1 },
];

/** A mini pipeline bar for the board tile. */
export function MiniBoard() {
  return (
    <div aria-hidden className="grid grid-cols-4 gap-2 select-none">
      {boardColumns.map((column) => (
        <div key={column.title} className="rounded-md bg-surface-sunken p-2">
          <span className={cn("block h-1 rounded-full", column.tone)} />
          <p className="mt-2 truncate text-[11px] font-semibold text-subtle uppercase">{column.title}</p>
          <p className="text-lg font-semibold text-foreground">{column.count}</p>
        </div>
      ))}
    </div>
  );
}

