import { SignedInOnly } from "@/components/auth/signed-in-only";
import { AppShell } from "@/components/layout/app-shell";
import { SideNav } from "@/components/layout/side-nav";
import { TopNav } from "@/components/layout/top-nav";

/** Signed-in area: top bar, sidebar, content. Signed-out visitors are sent to /sign-in. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SignedInOnly>
      <AppShell header={<TopNav />} sidebar={<SideNav />}>
        {children}
      </AppShell>
    </SignedInOnly>
  );
}
