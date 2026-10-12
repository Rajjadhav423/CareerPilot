import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { ROUTES } from "@/lib/routes";
import logo from "@/app/icon.png";
import { TextField } from "@/components/ui/text-field";
import { CreateMenu } from "./create-menu";
import { SidebarToggle } from "./sidebar-toggle";
import { ThemeMenu } from "./theme-menu";

export function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-surface px-2 md:px-3">
      <div className="flex shrink-0 items-center gap-1 md:w-64">
        <SidebarToggle />
        <Link
          href={ROUTES.dashboard}
          className="flex items-center gap-2 rounded-sm px-1.5 py-1 outline-none hover:bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Image src={logo} alt="" width={24} height={24} />
          <span className="text-base font-semibold text-foreground">CareerPilot</span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:justify-center">
        <TextField
          className="hidden w-full max-w-170 sm:flex"
          elemBefore={<Search />}
          placeholder="Search (coming soon)"
          aria-label="Search"
          disabled
        />
        <CreateMenu />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:min-w-16 md:justify-end">
        <ThemeMenu />
        {/* Clerk's account menu: profile, security, sign out */}
        <div className="flex size-8 items-center justify-center pointer-coarse:size-10">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
