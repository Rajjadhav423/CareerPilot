import { SITE } from "@/lib/site";

/** Readable layout for legal text: narrow column, comfortable spacing, styled headings and lists. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-subtlest">Last updated {SITE.legalLastUpdated}</p>
      <div className="mt-8 flex flex-col gap-4 text-foreground [&_a]:text-link [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:text-subtle [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-subtle">
        {children}
      </div>
    </article>
  );
}

export function ContactLine() {
  return SITE.contactEmail ? (
    <p>
      Questions? Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
    </p>
  ) : (
    <p>Contact details will be published here before CareerPilot opens to the public.</p>
  );
}
