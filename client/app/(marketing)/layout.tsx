import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Public pages (home, privacy, terms): visible without signing in. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <TooltipProvider>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </TooltipProvider>
  );
}
