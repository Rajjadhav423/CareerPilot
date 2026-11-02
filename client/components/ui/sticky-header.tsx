import { cn } from "@/lib/utils";

/**
 * Keeps a page's header (breadcrumbs, title, tabs) fixed under the top bar while the content below scrolls, like
 * Jira's board header. Put it directly inside the page, wrapping PageHeader and Tabs.
 *
 * It reaches up over <main>'s top padding (-mt-5 pt-5) and sideways with a shadow, so cards scrolling underneath are
 * hidden edge to edge, never peeking above or beside it.
 */
function StickyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sticky-header"
      className={cn(
        "sticky top-12 z-20 -mt-5 bg-surface pt-5 shadow-[-2rem_0_0_var(--color-surface),2rem_0_0_var(--color-surface)]",
        className,
      )}
      {...props}
    />
  );
}

export { StickyHeader };
