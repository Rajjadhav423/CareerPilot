/**
 * A complete example document for trying the document editor: header, summary, experience with dates on the right,
 * a two-column skills table, numbered and bulleted lists, links and custom styles. It follows the document rules
 * (GET /api/v1/docs/rules), so Check passes as is.
 */
export const SAMPLE_DOCUMENT = {
  schemaVersion: 3,
  document: "resume",
  preset: "modern",
  meta: { title: "Aarav Mehta — Resume", author: "Aarav Mehta", subject: "Resume", language: "en" },
  page: { size: "A4", margin: "14mm 16mm", maxPages: 2, pageNumbers: true },
  styles: {
    ".tag": { "background-color": "#e9f2ff", color: "#0c66e4", padding: "1pt 4pt", "font-size": "8.5pt" },
    ".muted": { color: "#626f86" },
    ".date": { float: "right", color: "#44474f", "font-size": "9pt" },
    "td.label": { width: "28%", "font-weight": "600", "padding-bottom": "3pt" },
    "td": { "padding-bottom": "3pt" },
  },
  sections: [
    {
      id: "header",
      title: "Header",
      style: { "margin-top": "0" },
      nodes: [
        { tag: "h1", class: "name", role: "name", text: "Aarav Mehta" },
        { tag: "p", class: "headline", role: "headline", text: "Senior Backend Engineer · Java, Node.js, PostgreSQL" },
        {
          tag: "p",
          class: "contact",
          role: "contact",
          children: [
            { tag: "a", class: "contact-link", attrs: { href: "mailto:aarav.mehta@example.com" }, text: "aarav.mehta@example.com" },
            { tag: "span", class: "sep", text: " | " },
            { tag: "span", text: "+91 98765 43210" },
            { tag: "span", class: "sep", text: " | " },
            { tag: "span", text: "Pune, India" },
            { tag: "span", class: "sep", text: " | " },
            { tag: "a", class: "contact-link", attrs: { href: "https://github.com/aarav-example" }, text: "github.com/aarav-example" },
          ],
        },
      ],
    },
    {
      id: "summary",
      title: "Summary",
      nodes: [
        { tag: "h2", class: "section-title", role: "section-title", text: "Summary" },
        {
          tag: "p",
          class: "summary first",
          role: "summary",
          html: "Backend engineer with <b>7 years</b> building payment and logistics platforms. Cut API latency by <b>45%</b>, led a team of 5, and enjoy turning slow, fragile systems into <i>boring, reliable</i> ones.",
        },
      ],
    },
    {
      id: "experience",
      title: "Experience",
      nodes: [
        { tag: "h2", class: "section-title", role: "section-title", text: "Experience" },
        {
          tag: "div",
          id: "job-fintech",
          class: "entry first",
          role: "entry",
          data: { title: "Senior Backend Engineer", org: "PayLane", start: "2022-03", end: null },
          children: [
            {
              tag: "h3",
              class: "entry-title",
              role: "entry-title",
              children: [
                { tag: "span", text: "Senior Backend Engineer · PayLane" },
                { tag: "span", class: "date", text: "Mar 2022 – Present" },
              ],
            },
            { tag: "p", class: "entry-subtitle muted", role: "organization", text: "Bengaluru · Hybrid" },
            {
              tag: "ul",
              class: "entry-highlights",
              children: [
                { tag: "li", role: "bullet", html: "Redesigned the settlement service in <b>Java 21</b>; p95 latency down from 820 ms to <b>450 ms</b>." },
                { tag: "li", role: "bullet", html: "Moved 30 cron jobs to an event queue, removing <b>2 nightly outages</b> a month." },
                { tag: "li", role: "bullet", text: "Mentored 3 engineers; two were promoted within a year." },
              ],
            },
          ],
        },
        {
          tag: "div",
          id: "job-logistics",
          class: "entry",
          role: "entry",
          data: { title: "Software Engineer", org: "ShipFast", start: "2019-01", end: "2022-02" },
          children: [
            {
              tag: "h3",
              class: "entry-title",
              role: "entry-title",
              children: [
                { tag: "span", text: "Software Engineer · ShipFast" },
                { tag: "span", class: "date", text: "Jan 2019 – Feb 2022" },
              ],
            },
            { tag: "p", class: "entry-subtitle muted", role: "organization", text: "Pune · On-site" },
            {
              tag: "ul",
              class: "entry-highlights",
              children: [
                { tag: "li", role: "bullet", html: "Built the route-planning API used by <b>1,200</b> drivers daily (Node.js, PostgreSQL)." },
                { tag: "li", role: "bullet", text: "Added contract tests to 14 services; production incidents fell by a third." },
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
          tag: "table",
          class: "first",
          children: [
            { tag: "tr", children: [
              { tag: "td", class: "label", text: "Languages" },
              { tag: "td", text: "Java, TypeScript, SQL, Go" },
            ] },
            { tag: "tr", children: [
              { tag: "td", class: "label", text: "Platforms" },
              { tag: "td", text: "Spring Boot, Node.js, PostgreSQL, Kafka, Redis" },
            ] },
            { tag: "tr", children: [
              { tag: "td", class: "label", text: "Cloud" },
              { tag: "td", children: [
                { tag: "span", text: "AWS, Docker, Kubernetes " },
                { tag: "span", class: "tag", text: "certified" },
              ] },
            ] },
          ],
        },
      ],
    },
    {
      id: "projects",
      title: "Projects",
      nodes: [
        { tag: "h2", class: "section-title", role: "section-title", text: "Projects" },
        {
          tag: "ol",
          class: "first",
          children: [
            { tag: "li", html: "<b>Ledgerly</b> — open-source double-entry ledger in Go; <a href=\"https://github.com/aarav-example/ledgerly\">github.com/aarav-example/ledgerly</a>" },
            { tag: "li", html: "<b>Queue Lens</b> — dashboard for Kafka consumer lag, used by 3 teams." },
          ],
        },
      ],
    },
    {
      id: "education",
      title: "Education",
      nodes: [
        { tag: "h2", class: "section-title", role: "section-title", text: "Education" },
        {
          tag: "h3",
          class: "entry-title first",
          children: [
            { tag: "span", text: "B.Tech, Computer Engineering · COEP Pune" },
            { tag: "span", class: "date", text: "2015 – 2019" },
          ],
        },
        { tag: "p", class: "muted", text: "CGPA 8.6 / 10" },
      ],
    },
  ],
};

export const SAMPLE_DOCUMENT_TEXT = JSON.stringify(SAMPLE_DOCUMENT, null, 2);
