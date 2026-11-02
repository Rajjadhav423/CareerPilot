import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  Lock,
  MailCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Columns3,
  X,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";
import {
  AppWindow,
  AssistantChat,
  EmailFinder,
  FollowUpTimeline,
  GmailSend,
  MatchGauge,
  MiniBoard,
  ResumeStack,
} from "@/components/marketing/home-visuals";
import { Button } from "@/components/ui/button";
import { Lozenge } from "@/components/ui/lozenge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} · ${SITE.tagline}` },
  description: SITE.description,
};

const stats = [
  { value: "50+", label: "live job sources" },
  { value: "1 click", label: "to email HR" },
  { value: "7 days", label: "to a follow-up nudge" },
  { value: "₹0", label: "during early access" },
];

const pipeline: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Search, title: "Discover", text: "Tech jobs from company boards and job feeds" },
  { icon: Target, title: "Match", text: "Scored against the skills in your resume" },
  { icon: MailCheck, title: "Apply", text: "Email HR from Gmail, resume attached" },
  { icon: Columns3, title: "Track", text: "Every application on one board" },
  { icon: BellRing, title: "Follow up", text: "Nudged when there's no reply" },
];

type Tile = { eyebrow: string; title: string; text: string; visual: React.ReactNode; className?: string };

const tiles: Tile[] = [
  {
    eyebrow: "Resume match",
    title: "Know your fit before you apply",
    text: "Every opening is scored against your resume, with the skills you have and the ones you're missing.",
    visual: <MatchGauge />,
    className: "lg:col-span-2",
  },
  {
    eyebrow: "HR email finder",
    title: "The right inbox, found for you",
    text: "Hiring emails are picked out of job posts, so you can filter to jobs you can apply to directly.",
    visual: <EmailFinder />,
  },
  {
    eyebrow: "Follow-ups",
    title: "Silence is a reminder, not a dead end",
    text: "Replies and bounces are detected automatically. After 7 quiet days, you're told to follow up in the same thread.",
    visual: <FollowUpTimeline />,
    className: "lg:row-span-2",
  },
  {
    eyebrow: "Gmail",
    title: "Send from your own address",
    text: "Your template, filled in for the job, your resume attached. You review, you press Send.",
    visual: <GmailSend />,
  },
  {
    eyebrow: "Resumes",
    title: "One resume, many tailored PDFs",
    text: "Build from templates, download clean PDFs or keep them in Google Drive.",
    visual: <ResumeStack />,
  },
  {
    eyebrow: "AI assistant",
    title: "Works with Claude",
    text: "Connect your AI assistant to search, tailor your resume truthfully and draft emails, with your approval at every step.",
    visual: <AssistantChat />,
    className: "sm:col-span-2",
  },
  {
    eyebrow: "Job board",
    title: "Every application, one view",
    text: "Saved to Offer on a board, or a sortable list.",
    visual: <MiniBoard />,
    className: "sm:col-span-2 lg:col-span-3",
  },
];

const before = [
  "Ten tabs of job sites, half of them non-tech roles",
  "Guessing whether a job fits your skills",
  "Hunting for who to email, then writing it from scratch",
  "Forgetting which companies never replied",
];

const after = [
  "One search across 50+ sources, tech roles only",
  "A match score with your skills and gaps",
  "HR emails found; one click to a ready email",
  "Follow-up reminders from real reply tracking",
];

const faqs = [
  { q: "Is CareerPilot free?", a: "Yes. It's free while in early access." },
  {
    q: "Where do the jobs come from?",
    a: "From companies' own career pages through the public APIs of Greenhouse, Lever, Ashby, SmartRecruiters and Recruitee, and from free job feeds such as Hacker News “Who is hiring”, We Work Remotely, Remotive and Jobicy. Every job links to the original posting.",
  },
  {
    q: "How is the match score worked out?",
    a: "CareerPilot reads the tech skills in your resume and in each job post (Java, React, AWS and so on) and shows how many of the job's skills you have. It's a guide for sorting, not a verdict: it doesn't judge seniority or years of experience.",
  },
  {
    q: "Does it send emails on my behalf?",
    a: "Only when you press Send. You connect Gmail through Google's permission screen and review every email first. CareerPilot then shows whether it was delivered, opened or answered.",
  },
  {
    q: "Do you scrape LinkedIn or Naukri?",
    a: "No, their terms don't allow it. Paste a job link you found anywhere and CareerPilot reads the details from that page for you.",
  },
  {
    q: "Who can see my data?",
    a: "Only you. Your jobs, resumes and emails are private to your account, and deleting your account deletes them.",
  },
];

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-semibold tracking-wide text-link uppercase", className)}>{children}</p>;
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-selected),transparent)]" />
        {/* Faint grid behind the headline */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] mask-[radial-gradient(50%_40%_at_50%_20%,black,transparent)] bg-size-[48px_48px] opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:pt-24">
          <Link href={ROUTES.signUp}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-subtle shadow-raised hover:text-foreground">
            <Lozenge appearance="new">New</Lozenge> Resume match and follow-up reminders <ArrowRight className="size-3.5" />
          </Link>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
            Your job search, on <span className="text-link">autopilot</span>. You stay the pilot.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-subtle sm:text-xl">
            CareerPilot finds tech openings that fit your resume, gets your application to the right inbox and tells
            you when to follow up. Nothing is sent without your OK.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="primary" className="h-12 px-7 text-base">
              <Link href={ROUTES.signUp}>Start free <ArrowRight /></Link>
            </Button>
            <Button asChild className="h-12 px-7 text-base">
              <Link href="/#how-it-works">See how it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-subtlest">Free during early access · Sign up with Google or email</p>
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pb-16 sm:pb-24">
          <AppWindow />
        </div>
      </section>

      {/* Stats */}
      <section aria-label="CareerPilot in numbers" className="border-y border-border bg-surface-sunken">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 px-4 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className={cn("flex flex-col items-center gap-1 py-8 text-center",
              index % 2 === 1 && "border-l border-border", index >= 2 && "border-t border-border md:border-t-0",
              index === 2 && "md:border-l")}>
              <dt className="order-2 text-sm text-subtle">{stat.label}</dt>
              <dd className="order-1 text-3xl font-semibold tracking-tight text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pipeline */}
      <section id="how-it-works" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              One workflow, from first search to offer
            </h2>
          </div>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pipeline.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="group relative rounded-xl border border-border bg-surface p-5 shadow-raised">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-inverse">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-3xl font-semibold text-border">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-subtle">{text}</p>
                {index < pipeline.length - 1 && (
                  <ArrowRight aria-hidden className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-surface text-subtlest lg:block" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="scroll-mt-16 border-t border-border bg-surface-sunken">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-2xl">
            <Eyebrow>Features</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Built for developers who&apos;d rather be coding
            </h2>
            <p className="mt-4 text-lg text-subtle">Less copy-pasting between tabs, better-targeted applications, no forgotten follow-ups.</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <li key={tile.title} className={cn("flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-raised", tile.className)}>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-link uppercase">{tile.eyebrow}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{tile.title}</h3>
                  <p className="mt-2 text-sm text-subtle">{tile.text}</p>
                </div>
                <div className="mt-auto">{tile.visual}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Before / after */}
      <section className="bg-neutral-bold text-inverse">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-2xl">
            <Eyebrow className="text-inverse/70">Why CareerPilot</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Job hunting, minus the busywork</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-inverse/15 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-inverse/70">Without it</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {before.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-inverse/70">
                    <X className="mt-0.5 size-5 shrink-0" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-surface p-6 text-foreground sm:p-8">
              <h3 className="text-lg font-semibold">With CareerPilot</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {after.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bold text-inverse">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ul className="mt-12 grid gap-6 border-t border-inverse/15 pt-10 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "You stay in control", text: "Nothing is emailed or submitted without your explicit approval." },
              { icon: Sparkles, title: "Honest by design", text: "Tailored resumes reword your real experience; nothing is invented." },
              { icon: Lock, title: "Private to you", text: "Your jobs, resumes and emails are visible only to you." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon className="size-6 shrink-0 text-inverse/80" aria-hidden />
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-inverse/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:py-28 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">Good questions</h2>
            <p className="mt-4 text-subtle">Everything you need to know before you start.</p>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-border bg-surface px-5 py-4 open:shadow-raised">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground marker:hidden">
                  {faq.q}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-subtle">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="px-4 pb-20 sm:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-inverse/10 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-inverse sm:text-5xl">
            Your next role is already out there
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-inverse/80">
            Find it, apply with confidence and follow up on time. Free while in early access.
          </p>
          <Button asChild className="relative mt-8 h-12 border-transparent bg-surface px-7 text-base text-foreground hover:bg-surface-hovered">
            <Link href={ROUTES.signUp}>Start free <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
