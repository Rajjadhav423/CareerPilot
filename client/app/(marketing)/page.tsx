import type { Metadata } from "next";
import Link from "next/link";
import {
  Columns3,
  FileText,
  Filter,
  Lock,
  Mail,
  Search,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Button } from "@/components/ui/button";
import { Lozenge } from "@/components/ui/lozenge";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} · ${SITE.tagline}` },
  description: SITE.description,
};

type Feature = { icon: LucideIcon; title: string; text: string; soon?: boolean };

const features: Feature[] = [
  {
    icon: Search,
    title: "Find tech jobs in one place",
    text: "Live openings straight from company career pages (Greenhouse, Lever, Ashby), refreshed every 15 minutes.",
  },
  {
    icon: Filter,
    title: "Only the roles you want",
    text: "Non-tech roles are filtered out. Narrow down to Backend, Frontend, DevOps, Data/ML and more, by location.",
  },
  {
    icon: Columns3,
    title: "Track every application",
    text: "Save jobs to a board and move them from Saved to Applied, Interview and Offer. Nothing slips through.",
  },
  {
    icon: Smartphone,
    title: "Works on any device",
    text: "Built for phones, tablets and desktops, with light and dark themes.",
  },
  {
    icon: FileText,
    title: "Tailored resumes, truthfully",
    text: "Drafts shaped for each role from your verified experience. It never invents skills or achievements.",
    soon: true,
  },
  {
    icon: Mail,
    title: "Gmail and reminders",
    text: "Import job alerts from your inbox, draft application emails and get follow-up reminders.",
    soon: true,
  },
];

const steps = [
  { title: "Create your free account", text: "Sign up with Google or email in under a minute." },
  { title: "Find and save openings", text: "Search live tech jobs and save the ones worth a shot." },
  { title: "Apply and track progress", text: "Move each job across your board as you apply and interview." },
];

const faqs = [
  {
    q: "Is CareerPilot free?",
    a: "Yes. It's in early access and free to use while we build it.",
  },
  {
    q: "Where do the jobs come from?",
    a: "From companies' own career pages, through the official public job-board APIs of Greenhouse, Lever and Ashby. You always apply on the company's site.",
  },
  {
    q: "Do you scrape LinkedIn or Naukri?",
    a: "No. Their terms don't allow it. Later you'll be able to import job alerts that those sites email to you, from your own Gmail, with your permission.",
  },
  {
    q: "Who can see my data?",
    a: "Only you. Your saved jobs are private to your account, and deleting your account deletes them. See the privacy policy for details.",
  },
  {
    q: "Will it apply to jobs for me?",
    a: "No. CareerPilot prepares and organises; nothing is sent or submitted on your behalf without your explicit approval.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
        <div>
          <Lozenge appearance="inprogress">Early access</Lozenge>
          <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">
            {SITE.tagline}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-subtle">{SITE.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary" className="h-10 px-5 text-base">
              <Link href={ROUTES.signUp}>Get started free</Link>
            </Button>
            <Button asChild className="h-10 px-5 text-base">
              <Link href={ROUTES.signIn}>Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-subtlest">Sign up with Google or email. No credit card.</p>
        </div>
        <div className="min-w-0">
          <ProductPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-t border-border bg-surface-sunken">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Everything for your job search</h2>
          <p className="mt-2 max-w-2xl text-subtle">
            Built for software developers: find the right openings, stay organised, and prepare better applications.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text, soon }) => (
              <li key={title} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-md bg-selected text-selected-text">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {soon && <Lozenge appearance="new">Coming soon</Lozenge>}
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-subtle">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-inverse">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-subtle">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-border bg-surface-sunken">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-2">
          <div className="flex gap-4">
            <ShieldCheck className="size-8 shrink-0 text-brand" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-foreground">You stay in control</h3>
              <p className="mt-1 text-subtle">
                CareerPilot prepares and organises. Nothing is emailed or submitted without your approval, and it
                never invents qualifications.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Lock className="size-8 shrink-0 text-brand" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Private by design</h3>
              <p className="mt-1 text-subtle">
                Your jobs and notes are visible only to you. Sign-in is handled by Clerk; we never see your password.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Questions</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground marker:hidden">
                  {faq.q}
                  <span className="text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-subtle">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="border-t border-border bg-brand">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-inverse">Ready to organise your job search?</h2>
            <p className="mt-1 text-inverse/80">Free while in early access.</p>
          </div>
          <Button asChild className="h-10 border-transparent bg-surface px-5 text-base text-foreground hover:bg-surface-hovered">
            <Link href={ROUTES.signUp}>Get started free</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
