"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Lozenge } from "@/components/ui/lozenge";
import { ROUTES } from "@/lib/routes";
import { navSections } from "./nav-items";

const itemClass =
  "relative flex h-8 pointer-coarse:h-11 items-center gap-2.5 rounded-sm px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus [&_svg]:size-4 [&_svg]:shrink-0";

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  // The overview is the prefix of every app page, so it only matches exactly.
  return href === ROUTES.dashboard ? pathname === href : pathname.startsWith(href);
}

/** Sidebar links with the current page highlighted. */
export function SideNavLinks() {
  const pathname = usePathname();
  return <LinkSections pathname={pathname} />;
}

/** Same links without reading the URL. Used as the Suspense fallback. */
export function SideNavLinksFallback() {
  return <LinkSections pathname={null} />;
}

function LinkSections({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      {navSections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title && (
            <p className="px-2 pb-1 text-xs font-semibold text-subtlest">{section.title}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map(({ label, href, icon: Icon, comingSoon }) => {
              if (comingSoon) {
                return (
                  <li key={href}>
                    <span aria-disabled className={cn(itemClass, "cursor-not-allowed text-subtlest")}>
                      <Icon aria-hidden />
                      <span className="flex-1 truncate">{label}</span>
                      <Lozenge>Soon</Lozenge>
                    </span>
                  </li>
                );
              }

              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      itemClass,
                      active
                        ? "bg-selected font-medium text-selected-text before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-brand hover:bg-selected-hovered"
                        : "text-subtle hover:bg-neutral-subtle-hovered hover:text-foreground active:bg-neutral-subtle-pressed",
                    )}
                  >
                    <Icon aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
