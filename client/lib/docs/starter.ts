import type { DocDocument } from "@/lib/api/docs";

/**
 * A small, valid document to start from (new resumes, or a form that can't be converted yet).
 * Uses the Classic preset's classes; replace the placeholder text or paste a whole document over it.
 */
export function starterDocument(): DocDocument {
  return {
    schemaVersion: 3,
    document: "resume",
    preset: "classic",
    meta: { title: "Your Name — Resume", author: "Your Name", language: "en" },
    page: { size: "A4", margin: "15mm 16mm", maxPages: 1 },
    sections: [
      {
        id: "header",
        title: "Header",
        style: { "margin-top": "0" },
        nodes: [
          { tag: "h1", class: "name header", role: "name", text: "Your Name" },
          { tag: "p", class: "headline header", role: "headline", text: "Your headline, e.g. Backend Engineer" },
          {
            tag: "p",
            class: "contact header",
            role: "contact",
            children: [
              { tag: "a", class: "contact-link", role: "link", attrs: { href: "mailto:you@example.com" }, text: "you@example.com" },
              { tag: "span", class: "sep", text: " | " },
              { tag: "a", class: "contact-link", role: "link", attrs: { href: "https://github.com/your-username" }, text: "github.com/your-username" },
            ],
          },
        ],
      },
      {
        id: "summary",
        title: "Summary",
        nodes: [
          { tag: "h2", class: "section-title", role: "section-title", text: "Summary" },
          { tag: "p", class: "summary first", role: "summary", html: "Two or three lines about what you do, with <b>key skills</b> in bold." },
        ],
      },
      {
        id: "experience",
        title: "Experience",
        nodes: [
          { tag: "h2", class: "section-title", role: "section-title", text: "Experience" },
          {
            id: "exp-1",
            tag: "div",
            class: "entry first",
            role: "entry",
            data: { kind: "job", title: "Job title", org: "Company", start: "2024-01", end: null },
            children: [
              {
                tag: "div",
                class: "entry-head",
                children: [
                  {
                    tag: "div",
                    class: "entry-main",
                    children: [
                      { tag: "h3", class: "entry-title", role: "entry-title", text: "Job title" },
                      { tag: "p", class: "entry-subtitle", role: "organization", text: "Company · City" },
                    ],
                  },
                  { tag: "p", class: "entry-dates", role: "date", text: "Jan 2024 – Present" },
                ],
              },
              {
                tag: "ul",
                class: "entry-highlights",
                children: [
                  { tag: "li", role: "bullet", text: "What you built or improved, with a number if you can." },
                  { tag: "li", role: "bullet", text: "Another achievement." },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "skills",
        title: "Skills",
        nodes: [
          { tag: "h2", class: "section-title", role: "section-title", text: "Skills" },
          {
            tag: "p",
            class: "skill first",
            role: "skill-group",
            children: [
              { tag: "span", class: "skill-name", text: "Languages:" },
              { tag: "span", text: " Java, TypeScript, SQL" },
            ],
          },
        ],
      },
    ],
  };
}
