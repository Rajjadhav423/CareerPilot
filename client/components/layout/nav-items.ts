import { Briefcase, FileText, LayoutDashboard, Settings, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not built yet: shown in the sidebar but not clickable. */
  comingSoon?: boolean;
};

export type NavSection = { title?: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Job board", href: "/jobs", icon: Briefcase },
    ],
  },
  {
    title: "Coming soon",
    items: [
      { label: "Profile", href: "/profile", icon: UserRound, comingSoon: true },
      { label: "Resumes", href: "/resumes", icon: FileText, comingSoon: true },
      { label: "Settings", href: "/settings", icon: Settings, comingSoon: true },
    ],
  },
];
