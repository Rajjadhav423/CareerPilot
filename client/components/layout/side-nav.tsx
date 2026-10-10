import { Suspense } from "react";

import { SideNavLinks, SideNavLinksFallback } from "./side-nav-links";

export function SideNav() {
  return (
    <nav aria-label="Main" className="flex flex-col p-3">
      {/* usePathname needs a Suspense boundary under cacheComponents for dynamic routes */}
      <Suspense fallback={<SideNavLinksFallback />}>
        <SideNavLinks />
      </Suspense>
    </nav>
  );
}
