package com.careerpilot.backend.discovery;

import java.util.Locale;

public enum WorkplaceType {
    ONSITE,
    HYBRID,
    REMOTE,
    UNSPECIFIED;

    /** Normalises provider values such as "onsite", "OnSite", "on-site", "Remote". */
    public static WorkplaceType from(String value) {
        if (value == null) {
            return UNSPECIFIED;
        }
        return switch (value.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "")) {
            case "onsite", "inoffice", "office" -> ONSITE;
            case "hybrid" -> HYBRID;
            case "remote" -> REMOTE;
            default -> UNSPECIFIED;
        };
    }
}
