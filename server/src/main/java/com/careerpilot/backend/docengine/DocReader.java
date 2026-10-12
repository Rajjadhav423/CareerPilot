package com.careerpilot.backend.docengine;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocModel.Kind;
import com.careerpilot.backend.docengine.DocModel.Meta;
import com.careerpilot.backend.docengine.DocModel.Node;
import com.careerpilot.backend.docengine.DocModel.Page;
import com.careerpilot.backend.docengine.DocModel.Section;

/**
 * Reads and validates document JSON against doc-rules.md.
 *
 * <ul>
 *   <li><b>STRICT</b> (API, MCP): every broken rule is an error and no document is returned.</li>
 *   <li><b>LENIENT</b> (UI import): fixable problems are repaired (unknown fields dropped, bad tags unwrapped,
 *       invalid CSS removed, long text cut…) and reported as warnings; the result is always valid.</li>
 * </ul>
 * Paths in issues are JSON Pointers (RFC 6901), e.g. {@code /sections/1/nodes/0/style/display}.
 */
public final class DocReader {

    public enum Mode {
        STRICT, LENIENT
    }

    public record Issue(String path, String code, String message) {
    }

    public record Result(Doc doc, List<Issue> errors, List<Issue> warnings) {
        public boolean valid() {
            return errors.isEmpty();
        }
    }

    // ---- limits (doc-rules.md §11) ----
    static final int MAX_SECTIONS = 50;
    static final int MAX_NODES = 2000;
    static final int MAX_DEPTH = 12;
    static final int MAX_CHILDREN = 200;
    static final int MAX_TEXT = 5000;
    static final int MAX_STYLE_RULES = 100;
    static final int MAX_DECLARATIONS = 40;
    static final int MAX_PAGES = 10;

    // ---- tags (doc-rules.md §6) ----
    static final Set<String> INLINE = Set.of("span", "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup",
            "code", "abbr", "time", "a", "br");
    /** Blocks whose content is inline only (text, html or inline children). */
    static final Set<String> TEXT_BLOCKS = Set.of("h1", "h2", "h3", "h4", "h5", "h6", "p", "pre", "address", "dt");
    /** Blocks that may contain other blocks as well as inline content. */
    static final Set<String> CONTAINERS = Set.of("div", "section", "header", "footer", "article", "aside", "blockquote",
            "li", "dd", "td", "th");
    private static final Map<String, Set<String>> STRUCTURE = Map.of(
            "ul", Set.of("li"), "ol", Set.of("li"), "dl", Set.of("dt", "dd"),
            "table", Set.of("thead", "tbody", "tfoot", "tr"),
            "thead", Set.of("tr"), "tbody", Set.of("tr"), "tfoot", Set.of("tr"),
            "tr", Set.of("th", "td"));
    private static final Map<String, Set<String>> PARENTS = Map.of(
            "li", Set.of("ul", "ol"), "dt", Set.of("dl"), "dd", Set.of("dl"),
            "thead", Set.of("table"), "tbody", Set.of("table"), "tfoot", Set.of("table"),
            "tr", Set.of("table", "thead", "tbody", "tfoot"), "th", Set.of("tr"), "td", Set.of("tr"));
    static final Set<String> BLOCKED = Set.of("script", "style", "link", "meta", "iframe", "frame", "frameset", "object",
            "embed", "form", "input", "button", "select", "option", "textarea", "svg", "math", "video", "audio", "canvas",
            "base", "img", "picture", "source", "noscript", "template", "html", "head", "body", "title");
    static final Set<String> ROLES = Set.of("name", "headline", "contact", "section-title", "summary", "entry",
            "entry-title", "organization", "date", "bullet", "skill-group", "link", "letter-recipient", "letter-date",
            "letter-subject", "letter-salutation", "letter-body", "letter-closing", "signature");

    private static final Set<String> ROOT_KEYS = Set.of("schemaVersion", "document", "preset", "meta", "page", "styles", "sections");
    private static final Set<String> SECTION_KEYS = Set.of("id", "title", "visible", "style", "nodes");
    private static final Set<String> NODE_KEYS = Set.of("id", "tag", "class", "style", "attrs", "visible", "text", "html",
            "children", "role", "data");
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,40}");
    private static final Pattern CLASS = Pattern.compile("[a-z][a-z0-9-]{0,39}");
    private static final Pattern SELECTOR = Pattern.compile("(body|[a-z][a-z0-9]{0,9})?(?:\\.([a-z][a-z0-9-]{0,39}))?");
    private static final Pattern LANGUAGE = Pattern.compile("[a-z]{2,3}(-[A-Za-z]{2,4})?");
    private static final Pattern DATE = Pattern.compile("\\d{4}(-(0[1-9]|1[0-2]))?");
    private static final Pattern DATA_KEY = Pattern.compile("[a-zA-Z][a-zA-Z0-9]{0,30}");
    private static final Pattern MARGIN = Pattern.compile("(\\d{1,3}(?:\\.\\d{1,2})?)(mm|cm|in|pt|px)?");

    static final String DEFAULT_MARGIN = "15mm 16mm 16mm 16mm";

    private final Mode mode;
    private final Map<String, Map<String, Map<String, String>>> presets;
    private final List<Issue> errors = new ArrayList<>();
    private final List<Issue> warnings = new ArrayList<>();
    private final Set<String> ids = new HashSet<>();
    private final Set<String> definedClasses = new HashSet<>();
    private final List<String[]> usedClasses = new ArrayList<>();
    private int nodeCount;
    private int generatedIds;

    private DocReader(Mode mode, Map<String, Map<String, Map<String, String>>> presets) {
        this.mode = mode;
        this.presets = presets;
    }

    /**
     * @param presets style presets by id ({@code "classic"} → its {@code styles}); a document may name one
     */
    public static Result read(JsonNode json, Mode mode, Map<String, Map<String, Map<String, String>>> presets) {
        DocReader reader = new DocReader(mode, presets);
        Doc doc = reader.root(json);
        reader.classWarnings();
        boolean ok = reader.errors.isEmpty();
        return new Result(ok ? doc : null, List.copyOf(reader.errors), List.copyOf(reader.warnings));
    }

    // ---- issues ----

    /** A broken rule: an error in strict mode; repaired with a warning in lenient mode. */
    private void problem(String path, String code, String message) {
        (mode == Mode.STRICT ? errors : warnings).add(new Issue(path, code, message));
    }

    private void fatal(String path, String code, String message) {
        errors.add(new Issue(path, code, message));
    }

    private void warn(String path, String code, String message) {
        warnings.add(new Issue(path, code, message));
    }

    // ---- document ----

    private Doc root(JsonNode json) {
        if (json == null || !json.isObject()) {
            fatal("", "NOT_AN_OBJECT", "The document must be a JSON object.");
            return null;
        }
        unknownKeys(json, ROOT_KEYS, "");

        JsonNode version = json.get("schemaVersion");
        if (version == null || !version.isNumber() || version.intValue() != 3) {
            problem("/schemaVersion", "SCHEMA_VERSION", "Set \"schemaVersion\": 3.");
        }

        Kind kind = Kind.resume;
        JsonNode documentKind = json.get("document");
        if (documentKind == null || !documentKind.isString()
                || !Set.of("resume", "coverLetter").contains(documentKind.stringValue())) {
            problem("/document", "DOCUMENT_KIND", "Set \"document\" to \"resume\" or \"coverLetter\".");
        } else {
            kind = Kind.valueOf(documentKind.stringValue());
        }

        String preset = null;
        JsonNode presetNode = json.get("preset");
        if (presetNode != null && !presetNode.isNull()) {
            if (presetNode.isString() && presets.containsKey(presetNode.stringValue())) {
                preset = presetNode.stringValue();
                presets.get(preset).keySet().forEach(this::defineClass);
            } else {
                problem("/preset", "PRESET_UNKNOWN", "Unknown preset. Use one of: " + String.join(", ", presets.keySet()) + ".");
            }
        }

        Meta meta = meta(json.get("meta"));
        Page page = page(json.get("page"));
        Map<String, Map<String, String>> styles = styles(json.get("styles"));
        List<Section> sections = sections(json.get("sections"));
        return new Doc(3, kind, preset, meta, page, styles, sections);
    }

    private Meta meta(JsonNode node) {
        if (node == null || node.isNull()) {
            return new Meta(null, null, null, "en");
        }
        if (!node.isObject()) {
            problem("/meta", "WRONG_TYPE", "\"meta\" must be an object.");
            return new Meta(null, null, null, "en");
        }
        unknownKeys(node, Set.of("title", "author", "subject", "language"), "/meta");
        String language = string(node.get("language"), "/meta/language", 20);
        if (language != null && !LANGUAGE.matcher(language).matches()) {
            problem("/meta/language", "LANGUAGE_INVALID", "Use a language code like \"en\" or \"en-IN\".");
            language = null;
        }
        return new Meta(string(node.get("title"), "/meta/title", 200), string(node.get("author"), "/meta/author", 100),
                string(node.get("subject"), "/meta/subject", 200), language == null ? "en" : language);
    }

    private Page page(JsonNode node) {
        PageSize size = PageSize.A4;
        String margin = DEFAULT_MARGIN;
        int maxPages = MAX_PAGES;
        boolean pageNumbers = true;
        if (node == null || node.isNull()) {
            return new Page(size, margin, maxPages, pageNumbers);
        }
        if (!node.isObject()) {
            problem("/page", "WRONG_TYPE", "\"page\" must be an object.");
            return new Page(size, margin, maxPages, pageNumbers);
        }
        unknownKeys(node, Set.of("size", "margin", "maxPages", "pageNumbers"), "/page");
        JsonNode sizeNode = node.get("size");
        if (sizeNode != null && !sizeNode.isNull()) {
            String value = sizeNode.asString("").toUpperCase(Locale.ROOT);
            if (value.equals("A4") || value.equals("LETTER")) {
                size = PageSize.valueOf(value);
            } else {
                problem("/page/size", "PAGE_SIZE", "Use \"A4\" or \"LETTER\".");
            }
        }
        JsonNode marginNode = node.get("margin");
        if (marginNode != null && !marginNode.isNull()) {
            String parsed = marginNode.isString() || marginNode.isNumber() ? margin(marginNode.asString()) : null;
            if (parsed == null) {
                problem("/page/margin", "PAGE_MARGIN", "Use 1–4 lengths from 0 to 40mm, e.g. \"15mm 16mm\".");
            } else {
                margin = parsed;
            }
        }
        JsonNode max = node.get("maxPages");
        if (max != null && !max.isNull()) {
            if (max.isIntegralNumber() && max.intValue() >= 1 && max.intValue() <= MAX_PAGES) {
                maxPages = max.intValue();
            } else {
                problem("/page/maxPages", "MAX_PAGES", "maxPages must be a whole number from 1 to " + MAX_PAGES + ".");
            }
        }
        JsonNode numbers = node.get("pageNumbers");
        if (numbers != null && !numbers.isNull()) {
            if (numbers.isBoolean()) {
                pageNumbers = numbers.booleanValue();
            } else {
                problem("/page/pageNumbers", "WRONG_TYPE", "pageNumbers must be true or false.");
            }
        }
        return new Page(size, margin, maxPages, pageNumbers);
    }

    /** "12mm 16mm" → "12mm 16mm 12mm 16mm" (all in mm, 0–40); null if invalid. */
    static String margin(String value) {
        String[] parts = value.strip().split("\\s+");
        if (parts.length < 1 || parts.length > 4) {
            return null;
        }
        double[] mm = new double[parts.length];
        for (int i = 0; i < parts.length; i++) {
            Matcher m = MARGIN.matcher(parts[i].toLowerCase(Locale.ROOT));
            if (!m.matches()) {
                return null;
            }
            double n = Double.parseDouble(m.group(1));
            String unit = m.group(2) == null ? "mm" : m.group(2);
            mm[i] = switch (unit) {
                case "cm" -> n * 10;
                case "in" -> n * 25.4;
                case "pt" -> n * 25.4 / 72;
                case "px" -> n * 25.4 / 96;
                default -> n;
            };
            if (mm[i] > 40.001) {
                return null;
            }
        }
        double top = mm[0];
        double right = mm.length > 1 ? mm[1] : top;
        double bottom = mm.length > 2 ? mm[2] : top;
        double left = mm.length > 3 ? mm[3] : right;
        return String.format(Locale.ROOT, "%smm %smm %smm %smm", num(top), num(right), num(bottom), num(left));
    }

    private static String num(double value) {
        double rounded = Math.round(value * 10) / 10.0;
        return rounded == Math.rint(rounded) ? Long.toString((long) rounded) : Double.toString(rounded);
    }

    // ---- styles ----

    private Map<String, Map<String, String>> styles(JsonNode node) {
        Map<String, Map<String, String>> styles = new LinkedHashMap<>();
        if (node == null || node.isNull()) {
            return styles;
        }
        if (!node.isObject()) {
            problem("/styles", "WRONG_TYPE", "\"styles\" must be an object of selector → declarations.");
            return styles;
        }
        int count = 0;
        for (Map.Entry<String, JsonNode> rule : node.properties()) {
            String selector = rule.getKey().strip();
            String path = "/styles/" + pointer(rule.getKey());
            if (++count > MAX_STYLE_RULES) {
                problem(path, "TOO_MANY_STYLES", "At most " + MAX_STYLE_RULES + " style rules; the rest were ignored.");
                break;
            }
            Matcher m = SELECTOR.matcher(selector);
            boolean valid = !selector.isEmpty() && m.matches()
                    && (m.group(1) == null || m.group(1).equals("body") || isKnownTag(m.group(1)));
            if (!valid) {
                problem(path, "SELECTOR_INVALID", "Selector \"" + CssRules.abbreviate(selector)
                        + "\" isn't allowed. Use body, a tag (h2), a class (.muted) or both (li.tight).");
                continue;
            }
            if (m.group(2) != null) {
                definedClasses.add(m.group(2));
            }
            Map<String, String> declarations = declarations(rule.getValue(), path);
            styles.put(selector, declarations);
        }
        return styles;
    }

    private void defineClass(String selector) {
        int dot = selector.indexOf('.');
        if (dot >= 0) {
            definedClasses.add(selector.substring(dot + 1));
        }
    }

    /** A style object: property → value (string or number). Invalid declarations are dropped or rejected. */
    private Map<String, String> declarations(JsonNode node, String path) {
        Map<String, String> style = new LinkedHashMap<>();
        if (node == null || node.isNull()) {
            return style;
        }
        if (!node.isObject()) {
            problem(path, "WRONG_TYPE", "A style must be an object like { \"color\": \"#1f2328\" }.");
            return style;
        }
        int count = 0;
        for (Map.Entry<String, JsonNode> declaration : node.properties()) {
            String property = declaration.getKey().strip().toLowerCase(Locale.ROOT);
            String propertyPath = path + "/" + pointer(declaration.getKey());
            if (++count > MAX_DECLARATIONS) {
                problem(propertyPath, "TOO_MANY_DECLARATIONS", "At most " + MAX_DECLARATIONS + " properties per style.");
                break;
            }
            JsonNode value = declaration.getValue();
            if (value == null || !(value.isString() || value.isNumber())) {
                problem(propertyPath, "CSS_VALUE_INVALID", "CSS values must be strings, e.g. \"10pt\".");
                continue;
            }
            CssRules.Check check = CssRules.check(property, value.asString());
            if (check.passed()) {
                style.put(property, check.value());
            } else {
                problem(propertyPath, check.code(), check.message());
            }
        }
        CssRules.contrastWarning(style).ifPresent(message -> warn(path + "/color", "LOW_CONTRAST", message));
        return style;
    }

    // ---- sections ----

    private List<Section> sections(JsonNode node) {
        List<Section> sections = new ArrayList<>();
        if (node == null || !node.isArray()) {
            problem("/sections", "MISSING_SECTIONS", "Add \"sections\": an array of sections.");
            return sections;
        }
        if (node.isEmpty()) {
            problem("/sections", "MISSING_SECTIONS", "Add at least one section.");
        }
        int index = 0;
        for (JsonNode section : node.values()) {
            String path = "/sections/" + index++;
            if (sections.size() >= MAX_SECTIONS) {
                problem(path, "TOO_MANY_SECTIONS", "At most " + MAX_SECTIONS + " sections; the rest were ignored.");
                break;
            }
            Section read = section(section, path, sections.size());
            if (read != null) {
                sections.add(read);
            }
        }
        return sections;
    }

    private Section section(JsonNode node, String path, int index) {
        if (node == null || !node.isObject()) {
            problem(path, "WRONG_TYPE", "A section must be an object with \"id\" and \"nodes\".");
            return null;
        }
        unknownKeys(node, SECTION_KEYS, path);
        String id = id(node.get("id"), path + "/id", true, "s" + (index + 1));
        String title = string(node.get("title"), path + "/title", 100);
        boolean visible = bool(node.get("visible"), path + "/visible", true);
        Map<String, String> style = declarations(node.get("style"), path + "/style");
        List<Node> nodes = new ArrayList<>();
        JsonNode list = node.get("nodes");
        if (list != null && !list.isNull()) {
            if (!list.isArray()) {
                problem(path + "/nodes", "WRONG_TYPE", "\"nodes\" must be an array.");
            } else {
                nodes = nodeList(list, path + "/nodes", null, 1);
            }
        }
        return new Section(id, title, visible, style, nodes);
    }

    // ---- nodes ----

    private List<Node> nodeList(JsonNode array, String path, String parentTag, int depth) {
        List<Node> nodes = new ArrayList<>();
        int index = 0;
        for (JsonNode child : array.values()) {
            String childPath = path + "/" + index++;
            if (nodes.size() >= MAX_CHILDREN) {
                problem(childPath, "TOO_MANY_CHILDREN", "At most " + MAX_CHILDREN + " children per element; the rest were ignored.");
                break;
            }
            Node node = node(child, childPath, parentTag, depth);
            if (node != null) {
                nodes.add(node);
            }
        }
        return nodes;
    }

    private Node node(JsonNode json, String path, String parentTag, int depth) {
        if (json == null || !json.isObject()) {
            problem(path, "WRONG_TYPE", "A node must be an object like { \"tag\": \"p\", \"text\": \"…\" }.");
            return null;
        }
        if (depth > MAX_DEPTH) {
            problem(path, "TOO_DEEP", "Elements can be nested at most " + MAX_DEPTH + " levels deep; this one was removed.");
            return null;
        }
        if (++nodeCount > MAX_NODES) {
            if (nodeCount == MAX_NODES + 1) {
                problem(path, "TOO_MANY_NODES", "At most " + MAX_NODES + " nodes in a document; the rest were ignored.");
            }
            return null;
        }
        unknownKeys(json, NODE_KEYS, path);

        String tag = tag(json.get("tag"), path, parentTag);
        if (tag == null) {
            return null;
        }

        String id = id(json.get("id"), path + "/id", false, null);
        List<String> classes = classes(json.get("class"), path + "/class");
        Map<String, String> style = declarations(json.get("style"), path + "/style");
        boolean visible = bool(json.get("visible"), path + "/visible", true);
        String role = role(json.get("role"), path + "/role");
        JsonNode data = data(json.get("data"), path + "/data");

        boolean acceptsContent = INLINE.contains(tag) && !"br".equals(tag) || TEXT_BLOCKS.contains(tag) || CONTAINERS.contains(tag);
        JsonNode textNode = present(json.get("text"));
        JsonNode htmlNode = present(json.get("html"));
        JsonNode childrenNode = present(json.get("children"));
        int contentFields = (textNode != null ? 1 : 0) + (htmlNode != null ? 1 : 0) + (childrenNode != null ? 1 : 0);
        if (contentFields > 1) {
            problem(path, "CONTENT_CONFLICT", "Use only one of \"text\", \"html\" or \"children\" (kept "
                    + (childrenNode != null ? "children" : "html") + ").");
            if (childrenNode != null) {
                textNode = null;
                htmlNode = null;
            } else {
                textNode = null;
            }
        }
        boolean structural = STRUCTURE.containsKey(tag);
        if (!acceptsContent && (textNode != null || htmlNode != null || (childrenNode != null && !structural))) {
            problem(path, "CONTENT_NOT_ALLOWED", "<" + tag + "> can't have " + (structural ? "text" : "content")
                    + (structural ? "; put it in " + String.join("/", STRUCTURE.get(tag)) + " children." : "."));
            textNode = null;
            htmlNode = null;
            if (!structural) {
                childrenNode = null;
            }
        }

        String text = null;
        String html = null;
        List<Node> children = List.of();
        if (textNode != null) {
            text = text(textNode, path + "/text");
        } else if (htmlNode != null) {
            String raw = text(htmlNode, path + "/html");
            if (raw != null) {
                InlineHtml.Result parsed = InlineHtml.parse(raw);
                parsed.problems().forEach(p -> problem(path + "/html", p.code(), p.message()));
                html = parsed.html();
                children = parsed.nodes();
            }
        } else if (childrenNode != null) {
            if (!childrenNode.isArray()) {
                problem(path + "/children", "WRONG_TYPE", "\"children\" must be an array of nodes.");
            } else {
                children = nodeList(childrenNode, path + "/children", tag, depth + 1);
            }
        }

        Map<String, String> attrs = attrs(json.get("attrs"), path + "/attrs", tag);
        if ("a".equals(tag) && !attrs.containsKey("href")) {
            problem(path + "/attrs/href", "LINK_MISSING_HREF", "A link needs \"attrs\": { \"href\": \"https://…\" }; shown as text.");
            tag = "span";
        }
        return new Node(id, tag, classes, style, attrs, visible, text, html, children, role, data);
    }

    private static JsonNode present(JsonNode node) {
        return node == null || node.isNull() ? null : node;
    }

    /** The tag, checked against the allowlist and its parent. Lenient mode substitutes a safe tag. */
    private String tag(JsonNode node, String path, String parentTag) {
        String tagPath = path + "/tag";
        if (node == null || !node.isString() || node.stringValue().isBlank()) {
            // Lenient: a node without a tag is removed (AI replies sometimes contain stray objects)
            problem(tagPath, "TAG_MISSING", "Every node needs a \"tag\", e.g. \"p\"; this one was removed.");
            return null;
        }
        String tag = node.stringValue().strip().toLowerCase(Locale.ROOT);
        if (BLOCKED.contains(tag)) {
            problem(tagPath, "TAG_BLOCKED", "<" + tag + "> isn't allowed in documents" + blockedHint(tag) + "; the node was removed.");
            return null;
        }
        if (!isKnownTag(tag)) {
            problem(tagPath, "TAG_UNKNOWN", "<" + CssRules.abbreviate(tag) + "> isn't a supported tag.");
            tag = parentTag != null && !allowsBlock(parentTag) ? "span" : "div";
        }
        Set<String> requiredParents = PARENTS.get(tag);
        if (requiredParents != null && (parentTag == null || !requiredParents.contains(parentTag))) {
            problem(tagPath, "TAG_WRONG_PARENT", "<" + tag + "> must be inside " + String.join(" or ",
                    requiredParents.stream().sorted().map(p -> "<" + p + ">").toList()) + ".");
            return parentTag != null && !allowsBlock(parentTag) ? "span" : "div";
        }
        if (parentTag != null) {
            Set<String> allowedChildren = STRUCTURE.get(parentTag);
            if (allowedChildren != null && !allowedChildren.contains(tag)) {
                problem(tagPath, "TAG_WRONG_CHILD", "<" + parentTag + "> may only contain "
                        + String.join(", ", allowedChildren.stream().sorted().map(c -> "<" + c + ">").toList()) + ".");
                // Lenient: keep the content as a list item; misplaced table parts are dropped
                return switch (parentTag) {
                    case "ul", "ol" -> "li";
                    case "dl" -> "dd";
                    default -> null;
                };
            }
            if (!allowsBlock(parentTag) && !INLINE.contains(tag)) {
                problem(tagPath, "BLOCK_IN_INLINE", "<" + tag + "> can't be inside <" + parentTag
                        + ">, which holds inline content only; it's printed as <span>.");
                return "span";
            }
            if ("a".equals(tag) && "a".equals(parentTag)) {
                problem(tagPath, "LINK_IN_LINK", "A link can't contain another link.");
                return "span";
            }
        }
        return tag;
    }

    private static String blockedHint(String tag) {
        return switch (tag) {
            case "img", "picture", "svg" -> " (images aren't supported yet)";
            case "style", "link" -> " (use \"styles\" and \"style\" instead)";
            case "script", "noscript", "template" -> " (no scripts in documents)";
            default -> "";
        };
    }

    static boolean isKnownTag(String tag) {
        return INLINE.contains(tag) || TEXT_BLOCKS.contains(tag) || CONTAINERS.contains(tag)
                || STRUCTURE.containsKey(tag) || "hr".equals(tag);
    }

    /** Section level (null) and containers accept blocks; everything else holds inline content only. */
    private static boolean allowsBlock(String parentTag) {
        return parentTag == null || CONTAINERS.contains(parentTag) || STRUCTURE.containsKey(parentTag);
    }

    private Map<String, String> attrs(JsonNode node, String path, String tag) {
        Map<String, String> attrs = new LinkedHashMap<>();
        if (node == null || node.isNull()) {
            return attrs;
        }
        if (!node.isObject()) {
            problem(path, "WRONG_TYPE", "\"attrs\" must be an object.");
            return attrs;
        }
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            String name = entry.getKey().toLowerCase(Locale.ROOT);
            String attrPath = path + "/" + pointer(entry.getKey());
            JsonNode raw = entry.getValue();
            String value = raw != null && (raw.isString() || raw.isNumber()) ? raw.asString().strip() : null;
            if (value == null) {
                problem(attrPath, "ATTR_INVALID", "Attribute values must be strings or numbers.");
                continue;
            }
            String checked = attribute(tag, name, value, attrPath);
            if (checked != null) {
                attrs.put(name, checked);
            }
        }
        return attrs;
    }

    private String attribute(String tag, String name, String value, String path) {
        switch (name) {
            case "href" -> {
                if (!"a".equals(tag)) {
                    break;
                }
                var link = SafeUrls.documentLink(value);
                if (link.isEmpty()) {
                    problem(path, "UNSAFE_LINK", "Only https, http, mailto and tel links are allowed (max "
                            + SafeUrls.MAX_LENGTH + " characters).");
                    return null;
                }
                return link.get();
            }
            case "title" -> {
                if (Set.of("a", "abbr").contains(tag) && value.length() <= 200) {
                    return value;
                }
            }
            case "colspan", "rowspan" -> {
                if (Set.of("td", "th").contains(tag)) {
                    return wholeNumber(value, 1, 20, path) ? value : null;
                }
            }
            case "start" -> {
                if ("ol".equals(tag)) {
                    return wholeNumber(value, 1, 1000, path) ? value : null;
                }
            }
            case "type" -> {
                if ("ol".equals(tag)) {
                    if (Set.of("1", "a", "A", "i", "I").contains(value)) {
                        return value;
                    }
                    problem(path, "ATTR_INVALID", "type must be 1, a, A, i or I.");
                    return null;
                }
            }
            case "datetime" -> {
                if ("time".equals(tag) && value.matches("[0-9T:+\\-.Z ]{4,40}")) {
                    return value;
                }
            }
            case "lang" -> {
                if (LANGUAGE.matcher(value).matches()) {
                    return value;
                }
            }
            default -> {
                // falls through to "not allowed"
            }
        }
        problem(path, name.startsWith("on") ? "ATTR_BLOCKED" : "ATTR_NOT_ALLOWED", "Attribute \"" + name + "\" isn't allowed on <"
                + tag + ">" + (name.equals("style") ? "; use the node's \"style\" field." : name.equals("class")
                        ? "; use the node's \"class\" field." : "."));
        return null;
    }

    private boolean wholeNumber(String value, int min, int max, String path) {
        if (value.matches("\\d{1,4}") && Integer.parseInt(value) >= min && Integer.parseInt(value) <= max) {
            return true;
        }
        problem(path, "ATTR_INVALID", "Must be a whole number from " + min + " to " + max + ".");
        return false;
    }

    private List<String> classes(JsonNode node, String path) {
        if (node == null || node.isNull()) {
            return List.of();
        }
        List<String> names = new ArrayList<>();
        if (node.isString()) {
            for (String name : node.stringValue().strip().split("\\s+")) {
                if (!name.isEmpty()) {
                    names.add(name);
                }
            }
        } else if (node.isArray()) {
            node.values().forEach(v -> names.add(v.asString("")));
        } else {
            problem(path, "WRONG_TYPE", "\"class\" must be a string like \"muted tight\".");
            return List.of();
        }
        List<String> valid = new ArrayList<>();
        for (String name : names) {
            if (CLASS.matcher(name).matches()) {
                if (!valid.contains(name)) {
                    valid.add(name);
                    usedClasses.add(new String[] {path, name});
                }
            } else {
                problem(path, "CLASS_INVALID", "Class \"" + CssRules.abbreviate(name)
                        + "\" must be lower-case letters, digits and dashes, starting with a letter.");
            }
        }
        return List.copyOf(valid);
    }

    private void classWarnings() {
        for (String[] used : usedClasses) {
            if (!definedClasses.contains(used[1])) {
                warn(used[0], "CLASS_UNDEFINED", "Class \"" + used[1] + "\" isn't defined in \"styles\" (or the preset).");
            }
        }
    }

    private String role(JsonNode node, String path) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isString() && ROLES.contains(node.stringValue())) {
            return node.stringValue();
        }
        problem(path, "ROLE_UNKNOWN", "Unknown role. Use one of: " + String.join(", ", ROLES.stream().sorted().toList()) + ".");
        return null;
    }

    /** {@code data}: flat facts about the node (no effect on rendering). Dates in start/end are YYYY or YYYY-MM. */
    private JsonNode data(JsonNode node, String path) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (!node.isObject() || node.size() > 20) {
            problem(path, "DATA_INVALID", "\"data\" must be an object with at most 20 fields.");
            return null;
        }
        for (Map.Entry<String, JsonNode> field : node.properties()) {
            String fieldPath = path + "/" + pointer(field.getKey());
            JsonNode value = field.getValue();
            boolean scalar = value.isNull() || value.isBoolean() || value.isNumber()
                    || (value.isString() && value.stringValue().length() <= 300);
            if (!DATA_KEY.matcher(field.getKey()).matches() || !scalar) {
                problem(fieldPath, "DATA_INVALID", "data fields need simple names and values (text up to 300 characters, numbers, true/false or null).");
                return null;
            }
            if (Set.of("start", "end").contains(field.getKey()) && value.isString() && !DATE.matcher(value.stringValue()).matches()) {
                problem(fieldPath, "DATA_DATE_FORMAT", "Dates in data use YYYY or YYYY-MM, e.g. \"2022-01\" (null = present).");
                return null;
            }
        }
        return node;
    }

    // ---- small values ----

    private String id(JsonNode node, String path, boolean required, String fallback) {
        String value = node == null || node.isNull() ? null : node.asString("");
        if (value == null) {
            if (required) {
                problem(path, "ID_MISSING", "Sections need an \"id\" like \"experience\".");
                return unique(fallback);
            }
            return null;
        }
        if (!ID.matcher(value).matches()) {
            problem(path, "ID_INVALID", "Ids use letters, digits, - and _ (1–40 characters).");
            return required ? unique(fallback) : null;
        }
        if (!ids.add(value)) {
            problem(path, "ID_DUPLICATE", "Id \"" + value + "\" is used twice; ids must be unique.");
            return required ? unique(fallback) : null;
        }
        return value;
    }

    private String unique(String base) {
        String candidate = base;
        while (!ids.add(candidate)) {
            candidate = base + "-" + (++generatedIds);
        }
        return candidate;
    }

    private String text(JsonNode node, String path) {
        if (!(node.isString() || node.isNumber() || node.isBoolean())) {
            problem(path, "WRONG_TYPE", "Text must be a string.");
            return null;
        }
        String value = node.asString();
        if (value.length() > MAX_TEXT) {
            problem(path, "TEXT_TOO_LONG", "At most " + MAX_TEXT + " characters per node; the rest was cut.");
            value = value.substring(0, MAX_TEXT);
        }
        return value;
    }

    private String string(JsonNode node, String path, int max) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (!node.isString()) {
            problem(path, "WRONG_TYPE", "Must be a string.");
            return null;
        }
        String value = node.stringValue().strip();
        if (value.length() > max) {
            problem(path, "TEXT_TOO_LONG", "At most " + max + " characters.");
            value = value.substring(0, max);
        }
        return value.isEmpty() ? null : value;
    }

    private boolean bool(JsonNode node, String path, boolean fallback) {
        if (node == null || node.isNull()) {
            return fallback;
        }
        if (!node.isBoolean()) {
            problem(path, "WRONG_TYPE", "Must be true or false.");
            return fallback;
        }
        return node.booleanValue();
    }

    private void unknownKeys(JsonNode node, Set<String> known, String path) {
        for (String name : node.propertyNames()) {
            if (!known.contains(name)) {
                problem(path + "/" + pointer(name), "UNKNOWN_FIELD", "Unknown field \"" + CssRules.abbreviate(name)
                        + "\". Allowed here: " + String.join(", ", known.stream().sorted().toList()) + ".");
            }
        }
    }

    /** Escapes a key for a JSON Pointer. */
    private static String pointer(String key) {
        return key.replace("~", "~0").replace("/", "~1");
    }
}
