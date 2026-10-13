import type { TechRole } from "@/lib/api/discover";

/*
 * Decides from a job title (and department/category) whether a posting is a tech job, and which kind.
 * Port of the backend's TechRoleClassifier: rules are checked in order, the first match wins, so specific
 * roles come before GENERAL.
 */

const words = (...alternatives: string[]) => new RegExp(`\\b(${alternatives.join("|")})\\b`, "i");

/** Non-tech, pre-sales or manager-of-product work, even if the title says "engineer" or "security". */
const EXCLUDED = words(
  "sales", "pre-?sales", "account (executive|manager|director)", "business development", "marketing",
  "go[ -]to[ -]market", "gtm", "recruit(er|ing|ment)?", "talent", "legal", "counsel", "finance",
  "accountant", "accounting", "audit", "payroll", "tax", "people partner", "human resources",
  "customer success", "solutions? (engineer|architect|consultant)", "field engineer", "customer engineer",
  "(technical )?program manager", "product manag(er|ement)", "project manager",
  "physical security", "security officer", "mechanical", "electrical", "hardware", "civil", "manufacturing",
  "facilit(y|ies)", "technician", "translator", "nurse", "driver", "teacher",
);

const RULES: [TechRole, RegExp][] = [
  ["QA", words("qa", "quality assurance", "sdet", "test engineer", "test automation", "automation test(ing|er)?", "engineer in test")],
  ["SECURITY", words("security", "appsec", "penetration", "pentest(er|ing)?")],
  ["DATA_ML", words("machine learning", "ml", "mlops", "ai engineer", "ai/ml", "llm", "deep learning", "nlp",
    "computer vision", "data (engineer|scientist|platform|infrastructure)", "analytics engineer",
    "research (engineer|scientist)")],
  ["DEVOPS", words("devops", "sre", "site reliability", "reliability engineer", "platform engineer(ing)?",
    "infrastructure", "cloud engineer", "production engineer", "kubernetes", "(?<!distributed )systems engineer",
    "network engineer", "release engineer", "build engineer")],
  ["MOBILE", words("android", "ios", "mobile", "flutter", "react native")],
  ["FULL_STACK", words("full[ -]?stack")],
  ["FRONTEND", words("front[ -]?end", "ui engineer", "web developer", "react", "angular", "vue")],
  ["BACKEND", words("back[ -]?end", "server[ -]side", "api", "distributed systems", "java", "golang",
    "microservices", "node\\.?js", "django", "spring")],
  ["GENERAL", words("software", "engineer", "engineering", "developer", "sde", "swe", "programmer",
    "member of technical staff", "tech lead", "architect")],
];

const ENGINEERING_DEPARTMENT = words("engineering", "technology", "r&d", "software development", "software-dev", "developer");

export function classifyTechRole(title: string, department?: string | null): TechRole | null {
  const safeTitle = title ?? "";
  const safeDepartment = department ?? "";
  if (EXCLUDED.test(safeTitle) || EXCLUDED.test(safeDepartment)) return null;
  for (const [role, pattern] of RULES) {
    if (pattern.test(safeTitle)) return role;
  }
  // e.g. an unusual title inside an "Engineering" team
  return ENGINEERING_DEPARTMENT.test(safeDepartment) ? "GENERAL" : null;
}
