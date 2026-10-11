import type { Metadata } from "next";

import { ContactLine, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using CareerPilot during early access.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>
        By creating an account or using CareerPilot you agree to these terms. They&apos;re written to be short and
        readable.
      </p>

      <h2>Early access</h2>
      <p>
        CareerPilot is in early access and free. Features may change, be removed or occasionally be unavailable. It is
        provided &quot;as is&quot;, without guarantees.
      </p>

      <h2>Job listings</h2>
      <p>
        Listings come from companies&apos; public career pages. We don&apos;t control them and can&apos;t guarantee
        they are accurate, complete or still open. Always check details and apply on the company&apos;s own site.
      </p>

      <h2>Your account and content</h2>
      <ul>
        <li>Keep your sign-in secure; you&apos;re responsible for activity on your account.</li>
        <li>The jobs and notes you add remain yours. You can delete them, or your whole account, at any time.</li>
        <li>Only add information you have the right to use.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t misuse the service: no attempts to access other people&apos;s data, overload, or break it.</li>
        <li>Don&apos;t scrape or automate access to CareerPilot.</li>
        <li>Use it lawfully and in line with the terms of the job sites you apply to.</li>
      </ul>
      <p>We may suspend accounts that break these rules.</p>

      <h2>No automatic actions</h2>
      <p>
        CareerPilot helps you prepare. It does not submit applications or send messages for you without your explicit
        approval, and you remain responsible for what you send to employers.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, CareerPilot is not liable for indirect losses, missed opportunities, or the
        outcome of any job application.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; the date at the top shows the latest version.</p>

      <ContactLine />
    </LegalPage>
  );
}
