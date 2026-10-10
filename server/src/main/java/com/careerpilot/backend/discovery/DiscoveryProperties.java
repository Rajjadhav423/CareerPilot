package com.careerpilot.backend.discovery;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param boards   job boards to read, each as "provider:slug:Company Name"
 * @param cacheTtl how long fetched postings are reused before boards are fetched again
 */
@ConfigurationProperties("careerpilot.discovery")
public record DiscoveryProperties(@DefaultValue List<String> boards, @DefaultValue("15m") Duration cacheTtl) {
}
