package com.careerpilot.backend.discovery;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Decides from a job title (and department) whether a posting is a tech job, and which kind.
 * Rules are checked in order; the first match wins, so specific roles come before GENERAL.
 */
final class TechRoleClassifier {

    /** Non-tech, pre-sales or manager-of-product work, even if the title says "engineer" or "security". */
    private static final Pattern EXCLUDED = words(
            "sales", "pre-?sales", "account (executive|manager|director)", "business development", "marketing",
            "go[ -]to[ -]market", "gtm", "recruit(er|ing|ment)?", "talent", "legal", "counsel", "finance",
            "accountant", "accounting", "audit", "payroll", "tax", "people partner", "human resources",
            "customer success", "solutions? (engineer|architect|consultant)", "field engineer", "customer engineer",
            "(technical )?program manager", "product manag(er|ement)", "project manager",
            "physical security", "security officer", "mechanical", "electrical", "hardware", "civil", "manufacturing",
            "facilit(y|ies)",
            "technician");

    private record Rule(TechRole role, Pattern pattern) {
    }

    private static final List<Rule> RULES = List.of(
            new Rule(TechRole.QA, words("qa", "quality assurance", "sdet", "test engineer", "test automation",
                    "automation test(ing|er)?", "engineer in test")),
            new Rule(TechRole.SECURITY, words("security", "appsec", "penetration", "pentest(er|ing)?")),
            new Rule(TechRole.DATA_ML, words("machine learning", "ml", "mlops", "ai engineer", "ai/ml", "llm",
                    "deep learning", "nlp", "computer vision", "data (engineer|scientist|platform|infrastructure)",
                    "analytics engineer", "research (engineer|scientist)")),
            new Rule(TechRole.DEVOPS, words("devops", "sre", "site reliability", "reliability engineer",
                    "platform engineer(ing)?", "infrastructure", "cloud engineer", "production engineer",
                    "kubernetes", "(?<!distributed )systems engineer", "network engineer", "release engineer",
                    "build engineer")),
            new Rule(TechRole.MOBILE, words("android", "ios", "mobile", "flutter", "react native")),
            new Rule(TechRole.FULL_STACK, words("full[ -]?stack")),
            new Rule(TechRole.FRONTEND, words("front[ -]?end", "ui engineer", "web developer", "react", "angular",
                    "vue")),
            new Rule(TechRole.BACKEND, words("back[ -]?end", "server[ -]side", "api", "distributed systems",
                    "java", "golang", "microservices", "node\\.?js", "django", "spring")),
            new Rule(TechRole.GENERAL, words("software", "engineer", "engineering", "developer", "sde", "swe",
                    "programmer", "member of technical staff", "tech lead", "architect")));

    private static final Pattern ENGINEERING_DEPARTMENT = words("engineering", "technology", "r&d");

    private TechRoleClassifier() {
    }

    static Optional<TechRole> classify(String title, String department) {
        String safeTitle = title == null ? "" : title;
        String safeDepartment = department == null ? "" : department;
        if (EXCLUDED.matcher(safeTitle).find() || EXCLUDED.matcher(safeDepartment).find()) {
            return Optional.empty();
        }
        for (Rule rule : RULES) {
            if (rule.pattern().matcher(safeTitle).find()) {
                return Optional.of(rule.role());
            }
        }
        // e.g. an unusual title inside an "Engineering" team
        return ENGINEERING_DEPARTMENT.matcher(safeDepartment).find() ? Optional.of(TechRole.GENERAL) : Optional.empty();
    }

    /** Case-insensitive match of any alternative as whole words. */
    private static Pattern words(String... alternatives) {
        return Pattern.compile("\\b(" + String.join("|", alternatives) + ")\\b", Pattern.CASE_INSENSITIVE);
    }
}
