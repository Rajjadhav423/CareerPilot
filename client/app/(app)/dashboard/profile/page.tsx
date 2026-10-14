import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";
import { AccountProfile } from "@/components/settings/account-profile";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your name, photo, email addresses and connected accounts."
        breadcrumbs={[{ label: "CareerPilot", href: ROUTES.dashboard }, { label: "Profile" }]}
      />
      <div className="@container max-w-4xl">
        <AccountProfile />
      </div>
    </>
  );
}
