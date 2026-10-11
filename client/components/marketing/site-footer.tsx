import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";
import logo from "@/app/icon.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-sunken">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Image src={logo} alt="" width={24} height={24} />
          <span className="font-semibold text-foreground">{SITE.name}</span>
          <span className="text-sm text-subtlest">· {SITE.tagline}</span>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={ROUTES.privacy} className="text-subtle hover:text-foreground hover:underline">
            Privacy policy
          </Link>
          <Link href={ROUTES.terms} className="text-subtle hover:text-foreground hover:underline">
            Terms of use
          </Link>
          <Link href={ROUTES.signIn} className="text-subtle hover:text-foreground hover:underline">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
