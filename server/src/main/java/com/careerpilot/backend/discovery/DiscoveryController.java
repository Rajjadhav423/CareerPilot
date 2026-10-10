package com.careerpilot.backend.discovery;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/discover")
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    public DiscoveryController(DiscoveryService discoveryService) {
        this.discoveryService = discoveryService;
    }

    /**
     * Search open jobs across the configured company job boards.
     * Example: GET /api/v1/discover/jobs?q=java&location=bengaluru&role=BACKEND
     */
    @GetMapping("/jobs")
    public DiscoverResponse jobs(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(required = false) TechRole role,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "false") boolean refresh) {
        return discoveryService.search(q, location, role, limit, refresh);
    }

}
