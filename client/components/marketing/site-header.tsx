"use client";

import Image from "next/image";
import Link from "next/link";
import { Show } from "@clerk/nextjs";

import { ROUTES } from "@/lib/routes";
import logo from "@/app/icon.png";
import { ThemeMenu } from "@/components/layout/theme-menu";
import { Button } from "@/components/ui/button";

const sections = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
];

/** Public pages' header: sign-in/sign-up for visitors, "Open dashboard" when already signed in. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href={ROUTES.home}
          className="flex shrink-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Image src={logo} alt="" width={28} height={28} />
          <span className="text-lg font-semibold text-foreground">CareerPilot</span>
        </Link>

        <nav aria-label="Sections" className="hidden flex-1 items-center gap-1 md:flex">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-sm px-3 py-1.5 text-sm font-medium text-subtle outline-none hover:bg-neutral-subtle-hovered hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeMenu />
          <Show when="signed-out">
            <Button asChild variant="subtle" className="max-sm:hidden">
              <Link href={ROUTES.signIn}>Sign in</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href={ROUTES.signUp}>Get started</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild variant="primary">
              <Link href={ROUTES.dashboard}>Open dashboard</Link>
            </Button>
          </Show>
        </div>
      </div>
    </header>
  );
}
