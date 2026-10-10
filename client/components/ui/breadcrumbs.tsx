import Link from "next/link";

import { cn } from "@/lib/utils";

type BreadcrumbItem = { label: string; href?: string };

function Breadcrumbs({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & { items: BreadcrumbItem[] }) {
  return (
    <nav data-slot="breadcrumbs" aria-label="Breadcrumbs" className={className} {...props}>
      <ol className="flex flex-wrap items-center text-sm text-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast && (
                <span aria-hidden className={cn("px-2 text-subtlest")}>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs, type BreadcrumbItem };
