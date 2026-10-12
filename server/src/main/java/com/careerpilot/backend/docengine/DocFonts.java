package com.careerpilot.backend.docengine;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;

/**
 * Fonts bundled with the engine (SIL Open Font License, files in {@code docengine/fonts/}). Documents may only
 * use these families: they're embedded and subset in every PDF, so text stays selectable and readable by
 * applicant tracking systems, and nothing is downloaded. To add a family: drop its .ttf files (400, 400 italic,
 * 600, 700) and OFL licence into the folder and list them here.
 */
public final class DocFonts {

    /** One font file. */
    public record BundledFont(String file, String family, int weight, FontStyle style) {
    }

    public static final List<BundledFont> FILES = List.of(
            new BundledFont("Inter-Regular.ttf", "Inter", 400, FontStyle.NORMAL),
            new BundledFont("Inter-Italic.ttf", "Inter", 400, FontStyle.ITALIC),
            new BundledFont("Inter-SemiBold.ttf", "Inter", 600, FontStyle.NORMAL),
            new BundledFont("Inter-Bold.ttf", "Inter", 700, FontStyle.NORMAL),
            new BundledFont("SourceSerif4-Regular.ttf", "Source Serif 4", 400, FontStyle.NORMAL),
            new BundledFont("SourceSerif4-Italic.ttf", "Source Serif 4", 400, FontStyle.ITALIC),
            new BundledFont("SourceSerif4-SemiBold.ttf", "Source Serif 4", 600, FontStyle.NORMAL),
            new BundledFont("SourceSerif4-Bold.ttf", "Source Serif 4", 700, FontStyle.NORMAL));

    /** Family name (as written in CSS) → generic fallback. Generic names map to a bundled family. */
    private static final Map<String, String> FAMILIES = new LinkedHashMap<>();

    static {
        FAMILIES.put("Inter", "sans-serif");
        FAMILIES.put("Source Serif 4", "serif");
    }

    public static final String DEFAULT_FAMILY = "Inter";

    private DocFonts() {
    }

    public static List<String> families() {
        return List.copyOf(FAMILIES.keySet());
    }

    /**
     * The bundled family for a name in a font-family list: an exact family (any case), or a generic name
     * ("sans-serif" → Inter, "serif" → Source Serif 4). Empty if we don't have it.
     */
    public static Optional<String> resolve(String name) {
        String wanted = name.strip().toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> family : FAMILIES.entrySet()) {
            if (family.getKey().toLowerCase(Locale.ROOT).equals(wanted)) {
                return Optional.of(family.getKey());
            }
        }
        for (Map.Entry<String, String> family : FAMILIES.entrySet()) {
            if (family.getValue().equals(wanted)) {
                return Optional.of(family.getKey());
            }
        }
        return Optional.empty();
    }
}
