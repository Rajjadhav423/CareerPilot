package com.careerpilot.backend.docengine;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * Limits that keep PDF generation predictable on a small server.
 *
 * @param maxPages         longest document we'll produce; longer input is rejected with a clear message
 * @param maxPdfSize       largest PDF we'll return or upload
 * @param renderTimeout    how long one PDF may take before the request fails
 * @param maxConcurrent    PDFs rendered at the same time (rendering is CPU and memory heavy)
 * @param maxQueued        requests allowed to wait for a free slot; more are refused as "busy"
 */
@ConfigurationProperties("careerpilot.docengine")
public record DocumentProperties(
        @DefaultValue("10") int maxPages,
        @DefaultValue("5MB") DataSize maxPdfSize,
        @DefaultValue("20s") Duration renderTimeout,
        @DefaultValue("2") int maxConcurrent,
        @DefaultValue("8") int maxQueued) {
}
