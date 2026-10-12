"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const SidebarContext = createContext<{ toggle: () => void } | null>(null);

export function useSidebar() {
  const context = use(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside <AppShell>");
  return context;
}

type AppShellProps = {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Jira-style page frame: top bar, left sidebar, main content.
 * Desktop: the toggle collapses the sidebar. Mobile: it opens the sidebar as a drawer.
 */
export function AppShell({ header, sidebar, children }: AppShellProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setDesktopCollapsed((c) => !c);
    else setMobileOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    // Stop the page behind the drawer from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <TooltipProvider>
      <SidebarContext value={{ toggle }}>
        {header}
        {/* The top bar is position: fixed (always visible, whatever the page contains); pt-12 makes room for it */}
        <div className="flex flex-1 pt-12">
          {mobileOpen && (
            <div
              aria-hidden
              className="fixed inset-0 top-12 z-30 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside
            id="app-sidebar"
            className={cn(
              "fixed top-12 bottom-0 left-0 z-40 w-68 overflow-y-auto border-r border-border bg-surface transition-transform duration-200",
              mobileOpen ? "translate-x-0 shadow-overlay" : "-translate-x-full max-md:invisible",
              "md:sticky md:z-auto md:h-[calc(100dvh-3rem)] md:translate-x-0 md:shadow-none",
              desktopCollapsed && "md:hidden",
            )}
            onClick={(event) => {
              // Close the mobile drawer after picking a page.
              if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
            }}
          >
            {sidebar}
          </aside>
          {/* overflow-x-clip: nothing inside can widen the page (which would let phones pan it sideways and move the top bar off-screen); unlike hidden, clip keeps sticky positioning working */}
          <main className="min-w-0 flex-1 overflow-x-clip px-4 pt-5 pb-8 md:px-8">{children}</main>
        </div>
      </SidebarContext>
    </TooltipProvider>
  );
}
