import {
  Briefcase,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Search,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";

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
      { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { label: "Find jobs", href: ROUTES.discover, icon: Search },
      { label: "Job board", href: ROUTES.jobs, icon: Briefcase },
      { label: "Resumes", href: ROUTES.resumes, icon: FileText },
      { label: "Documents", href: ROUTES.documents, icon: FolderOpen },
      { label: "Email templates", href: ROUTES.templates, icon: Mail },
    ],
  },
  {
    title: "Coming soon",
    items: [
      { label: "Profile", href: ROUTES.profile, icon: UserRound, comingSoon: true },
      { label: "Settings", href: ROUTES.settings, icon: Settings, comingSoon: true },
    ],
  },
];
