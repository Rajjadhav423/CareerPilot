package com.careerpilot.backend.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS for calls from the frontend's origin, applied by Spring Security ({@code http.cors()}).
 * The frontend sends the Clerk session token in the Authorization header, so that header is allowed;
 * no cookies are used, so credentials stay off.
 */
@Configuration
public class WebConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${careerpilot.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization"));
        // Lets the browser read the suggested file name of PDF downloads
        config.setExposedHeaders(List.of("Content-Disposition", "X-Document-Pages"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

}
