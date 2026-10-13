@AGENTS.md

# CareerPilot frontend (client/)

Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript, Tailwind CSS v4, pnpm.
Backend is the Spring Boot API in `../server` (default `http://localhost:8080`, `NEXT_PUBLIC_API_BASE_URL`).

Commands: `pnpm dev` · `pnpm build` · `pnpm lint` · type-check with `npx tsc --noEmit`.

## Design system: Jira / Atlassian look

The UI deliberately looks and behaves like Jira (Atlassian's new navigation): white or near-black surfaces,
a blue brand colour, compact 14px text, a left sidebar, a top bar with search and a blue "+ Create"
button, uppercase status lozenges and Kanban boards.

- **Colours are design tokens copied from `@atlaskit/tokens`** (Atlassian Design System, refreshed palette),
  defined once in `app/globals.css` for light and dark (`:root[data-theme="dark"]`).
- **Never hard-code colours in components.** Use the semantic Tailwind classes generated from the tokens:
  - surfaces: `bg-surface`, `bg-surface-sunken` (board columns, page backgrounds), `bg-surface-raised` (cards), `bg-surface-overlay` (menus, dialogs)
  - text: `text-foreground`, `text-subtle`, `text-subtlest`, `text-inverse`, `text-link`
  - interactive: `bg-brand` / `hover:bg-brand-hovered`, `bg-neutral-subtle-hovered`, `bg-selected` + `text-selected-text`
  - borders and focus: `border-border`, `border-border-input`, `ring-focus`
  - status: `bg-success`/`text-success-text`/`bg-success-bold` and the same for `danger`, `warning`, `information`, `discovery`
  - elevation: `shadow-raised`, `shadow-overlay`; radius: `rounded-sm` (4px controls), `rounded-lg` (8px cards)
- To add or change a colour, edit `globals.css` (both themes) instead of styling one component.
- **Theme:** `<html data-theme>` is set before paint by `themeInitScript` (`lib/theme.ts`). The theme menu offers Light,
  Dark or Match browser, plus an **accent colour** (default blue; overrides only brand/selected/link/focus tokens).
- Font: Inter (`--font-inter`); body 14px.
- Clerk's sign-in UI is themed with the same CSS variables in `lib/clerk-appearance.ts` (Clerk's styles live in the `clerk` CSS layer).

## Components: shadcn-inspired, reusable, in `components/ui/`

We take the shadcn/ui approach: our own components, in our repo, styled with Tailwind, and built on Radix primitives
when behaviour is complex (menus, dialogs, tooltips).

**Rule: if something could be used in more than one place (button, card, input, badge, dialog, table, empty state,
etc.), build it as a general-purpose component in `components/ui/` and import it from there.** Don't restyle a raw
`<button>`, `<input>` or `<div>` inside a feature component. If the UI component lacks something, extend it with a
new prop or variant rather than duplicating it.

Existing UI components (check here first):
`button` (variants: primary, default, subtle, danger, warning, link; sizes; `isSelected`, `isLoading`, `asChild`) ·
`card` · `lozenge` (Jira status badge) · `badge` (counts) · `board` (Board/BoardColumn/BoardCard) · `table` ·
`tabs` · `breadcrumbs` · `page-header` · `section-message` (alerts) · `empty-state` · `spinner` · `text-field` ·
`textarea` · `select` · `field` (label + hint + error) · `dialog` · `dropdown-menu` · `tooltip` ·
`date-picker` (`DatePicker` field + popover, `Calendar` month grid; values are "YYYY-MM-DD"; use it instead of
`<input type="date">`, whose popup ignores our theme).

How a UI component is written (follow `button.tsx` / `card.tsx`):
- One file per component, named exports, a function component taking `React.ComponentProps<"element">`
  (React 19 passes `ref` as a normal prop; no `forwardRef`).
- Variants with `cva` (class-variance-authority); merge classes with `cn()` from `lib/utils.ts` so callers can override via `className`.
- Add `data-slot="name"` on the root element.
- Only token-based classes; touch-friendly sizes via `pointer-coarse:` (see below).
- Radix comes from the single `radix-ui` package (`import { Dialog as DialogPrimitive } from "radix-ui"`).
- Icons: `lucide-react`.

Feature components (they use UI components and know about data) live by feature: `components/jobs`,
`components/discover`, `components/layout`, `components/marketing`, `components/auth`, `components/health`.

## Layout and routing

```
app/
  layout.tsx            root: fonts, theme script, ClerkProvider
  (marketing)/          public: / (home), /privacy, /terms (SiteHeader + SiteFooter)
  (auth)/               /sign-in, /sign-up (centered Clerk forms)
  (app)/dashboard/...   signed-in app: /dashboard, /dashboard/jobs, /dashboard/discover
```
- Signed-in pages use `AppShell` (`components/layout/app-shell.tsx`): top bar (`top-nav`), left sidebar (`side-nav`,
  items in `nav-items.ts`; collapsible on desktop, drawer on mobile), content area.
- Page pattern: `PageHeader` (breadcrumbs, title, description, actions), optional `Tabs`, then content.
- **All paths come from `ROUTES` in `lib/routes.ts`.** Never hard-code `"/dashboard/..."` strings.
- Public site copy lives in `lib/site.ts`.

## Responsive: every page must work on phone, tablet and desktop

- Prefer **container queries** (`@container`, `@2xl:`, `@4xl:`) where the sidebar changes the available width; use viewport breakpoints for the shell.
- Wide data: a table on wide containers and a card list on narrow ones (see `components/discover/job-results.tsx`).
- Touch: bigger targets with `pointer-coarse:` variants; inputs use 16px text on touch devices (stops iOS zoom).
- Rows of chips/filters swipe horizontally on narrow screens; board columns are 85% wide with scroll-snap on phones.
- No horizontal page scroll at 390px, 768px or 1440px wide. Check both light and dark.

## Data and auth

- Auth is Clerk. `proxy.ts` only runs `clerkMiddleware()` and makes no auth decisions. `components/auth/signed-in-only.tsx`
  sends signed-out visitors from the app to `/sign-in`. **The real security boundary is the Spring API**, which verifies
  the Clerk token on every request.
- Call the backend through `apiFetch` (`lib/api/client.ts`) with the Clerk token (`useAuth().getToken()`); one file per
  resource in `lib/api/` with types that mirror the backend DTOs.
- Client components that call the API **must wait for `useAuth().isLoaded`** (there is no token before Clerk loads).
- Server data uses TanStack Query hooks (see `lib/jobs/use-jobs.ts`: query keys, `enabled`, optimistic updates, invalidation).
- Any future server-side code that reads user data (route handlers, server actions, server components) must call `await auth.protect()` itself.

## Next.js 16 gotchas seen in this project

- Read `node_modules/next/dist/docs/` before using an unfamiliar API (see AGENTS.md).
- With `cacheComponents`, components that read the URL (`usePathname`, Clerk's `<SignIn/>` on catch-all routes) need a `<Suspense>` boundary.
- Don't gate a page's content behind client-only checks, or Next can't prerender it ("dropped from rendering"); render it and overlay instead.
- You can't pass functions (e.g. icon components) from a Server Component to a Client Component; import them inside the client file.
- React lint rule `set-state-in-effect`: don't call setState synchronously in an effect; set it in the promise callback.
- Next 16 renamed middleware to `proxy.ts`. Image `priority` is deprecated; use `preload` if needed.

## Before calling work done

`npx tsc --noEmit`, `pnpm lint` and `pnpm build` pass; new UI pieces are in `components/ui/` and use tokens only;
the page was checked at phone, tablet and desktop widths in light and dark.
