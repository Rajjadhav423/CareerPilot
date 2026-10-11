import type { Metadata } from "next";

import { ContactLine, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What CareerPilot stores, why, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        CareerPilot is a job search assistant in early access. This page explains, in plain language, what data it
        keeps and why. The short version: we keep only what&apos;s needed to run your account and your job board, we
        never sell it, and deleting your account deletes it.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account details</strong> from our sign-in provider: your email address, name, profile picture and
          when you last signed in.
        </li>
        <li>
          <strong>What you add</strong>: jobs you save or create, their status, links, descriptions and your notes.
        </li>
        <li>
          <strong>Technical logs</strong> kept briefly for security and troubleshooting, such as request times and
          error messages.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We never see or store your password. Sign-in is handled by Clerk.</li>
        <li>We don&apos;t sell your data, share it with advertisers, or show ads.</li>
        <li>We don&apos;t send applications or emails on your behalf without your explicit approval.</li>
      </ul>

      <h2>Services we use</h2>
      <ul>
        <li>
          <strong>Clerk</strong> handles sign-up and sign-in (including Google sign-in) and stores your account. See{" "}
          <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Clerk&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Job listings</strong> come from the public job-board APIs of Greenhouse, Lever and Ashby. We only
          read public postings; your data is not sent to them.
        </li>
        <li>Our hosting provider will be listed here when CareerPilot launches publicly.</li>
      </ul>

      <h2>Gmail (future feature)</h2>
      <p>
        We plan to let you connect Gmail to import job alerts and draft application emails. It will only ever be
        enabled if you choose to connect it, and this policy will be updated with exactly what is accessed before the
        feature goes live.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        Your data is kept while your account exists. To delete everything, open your account menu, choose{" "}
        <strong>Manage account</strong>, and delete your account. Your CareerPilot data, including saved jobs, is
        deleted automatically.
      </p>

      <h2>Security</h2>
      <p>
        Access to your data requires your signed-in session, every request is checked, and your jobs are visible only
        to you. In production all traffic is encrypted (HTTPS).
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update the date at the top and, for important changes, tell you in the app.</p>

      <ContactLine />
    </LegalPage>
  );
}
