import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import logo from "@/app/icon.png";
import { ThemeMenu } from "@/components/layout/theme-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Centered page for sign-in / sign-up, without the app's sidebar. Works on phones and desktops alike. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <TooltipProvider>
      <div className="relative flex min-h-dvh flex-col items-center bg-surface-sunken px-4 py-8 sm:justify-center sm:py-12">
        <div className="absolute top-3 right-3">
          <ThemeMenu />
        </div>
        <Link
          href={ROUTES.home}
          className="mb-6 flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Image src={logo} alt="" width={36} height={36} />
          <span className="text-2xl font-semibold text-foreground">CareerPilot</span>
        </Link>
        <main className="flex w-full justify-center">{children}</main>
        <p className="mt-6 max-w-sm text-center text-xs text-subtlest">
          Your personal job search assistant: find tech jobs, track applications, prepare better.
        </p>
      </div>
    </TooltipProvider>
  );
}
