"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, CornerDownLeft, FileText, Mail, Search, type LucideIcon } from "lucide-react";

import { useTemplates } from "@/lib/email/use-templates";
import { JOB_STATUSES } from "@/lib/jobs/statuses";
import { useJobs } from "@/lib/jobs/use-jobs";
import { useResumes } from "@/lib/resumes/use-resumes";
import { resumePath, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { navSections } from "./nav-items";

type Result = { id: string; group: string; label: string; detail?: string; href: string; icon: LucideIcon };

const MAX_PER_GROUP = 5;

/** Every word of the query appears somewhere in the text (case-insensitive). */
function matches(query: string, ...fields: (string | null | undefined)[]) {
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/**
 * Search in the top bar: pages, jobs, resumes and email templates. Ctrl/⌘+K or "/" focuses it; arrow keys and Enter
 * pick a result; Escape closes. On phones the field becomes an icon that opens a full-width search bar.
 */
export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const jobs = useJobs();
  const resumes = useResumes();
  const templates = useTemplates();

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    const pages: Result[] = navSections.flatMap((section) => section.items).map((item) => ({
      id: `page:${item.href}`, group: "Pages", label: item.label, href: item.href, icon: item.icon,
    }));
    if (!q) return pages;
    const status = (id: string) => JOB_STATUSES.find((s) => s.id === id)?.label;
    return [
      ...pages.filter((page) => matches(q, page.label)),
      ...(jobs.data ?? [])
        .filter((job) => matches(q, job.title, job.company, job.location, status(job.status)))
        .slice(0, MAX_PER_GROUP)
        .map((job) => ({
          id: `job:${job.id}`, group: "Jobs", label: job.title, icon: Briefcase, href: ROUTES.jobsList,
          detail: [job.company, status(job.status)].filter(Boolean).join(" · "),
        })),
      ...(resumes.data ?? [])
        .filter((resume) => matches(q, resume.title, resume.fullName))
        .slice(0, MAX_PER_GROUP)
        .map((resume) => ({
          id: `resume:${resume.id}`, group: "Resumes", label: resume.title, icon: FileText, href: resumePath(resume.id),
          detail: resume.fullName ?? undefined,
        })),
      ...(templates.data ?? [])
        .filter((template) => matches(q, template.name, template.subject))
        .slice(0, MAX_PER_GROUP)
        .map((template) => ({
          id: `template:${template.id}`, group: "Email templates", label: template.name, icon: Mail,
          href: ROUTES.templates, detail: template.subject,
        })),
    ];
  }, [query, jobs.data, resumes.data, templates.data]);

  // Ctrl/⌘+K or "/" (outside other fields) opens search
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement
        && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if ((event.key === "k" && (event.ctrlKey || event.metaKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setMobileOpen(true);
        setOpen(true);
        requestAnimationFrame(() => input.current?.focus());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicking elsewhere closes the results
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    input.current?.blur();
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setMobileOpen(false);
      input.current?.blur();
    }
  }

  const loading = query.trim() !== "" && (jobs.isPending || resumes.isPending || templates.isPending);

  return (
    <>
      {/* Phones: an icon that opens the search bar */}
      <Button variant="subtle" size="icon" className="sm:hidden" aria-label="Search"
        onClick={() => {
          setMobileOpen(true);
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}>
        <Search />
      </Button>

      <div
        ref={root}
        className={cn(
          "relative w-full max-w-170",
          mobileOpen
            ? "fixed inset-x-0 top-0 z-40 flex h-12 max-w-none items-center gap-1 border-b border-border bg-surface px-2"
            : "hidden sm:block",
        )}
      >
        {mobileOpen && (
          <Button variant="subtle" size="icon" className="sm:hidden" aria-label="Close search"
            onClick={() => { setMobileOpen(false); setOpen(false); }}>
            <ArrowLeft />
          </Button>
        )}
        <div className="relative w-full">
          <TextField
            ref={input}
            elemBefore={<Search />}
            placeholder="Search jobs, resumes, templates…"
            aria-label="Search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {!query && (
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-xs border border-border bg-surface-sunken px-1.5 font-mono text-[11px] text-subtlest md:block">
              Ctrl K
            </kbd>
          )}

          {open && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-border bg-surface-overlay shadow-overlay">
              <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain py-1">
                {results.map((result, i) => {
                  // A group heading above the first result of each group
                  const header = i === 0 || results[i - 1]!.group !== result.group ? result.group : null;
                  return (
                    <li key={result.id} role="presentation">
                      {header && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">{header}</p>}
                      <div
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onPointerEnter={() => setActive(i)}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => go(result)}
                        className={cn(
                          "mx-1 flex cursor-pointer items-center gap-3 rounded-xs px-2 py-1.5 text-sm pointer-coarse:py-2.5",
                          i === active ? "bg-selected text-selected-text" : "text-foreground",
                        )}
                      >
                        <result.icon className="size-4 shrink-0 text-subtle" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{result.label}</span>
                          {result.detail && <span className="block truncate text-xs text-subtle">{result.detail}</span>}
                        </span>
                        {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-subtle" aria-hidden />}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {results.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-subtle">
                  {loading ? "Searching…" : <>No results for &ldquo;{query.trim()}&rdquo;</>}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
