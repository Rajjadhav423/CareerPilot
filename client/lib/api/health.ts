import { apiFetch } from "./client";

/** Mirrors com.careerpilot.backend.health.HealthResponse */
export type HealthResponse = {
  status: "UP" | "DOWN";
  service: string;
  timestamp: string;
};

export function getHealth(signal?: AbortSignal) {
  return apiFetch<HealthResponse>("/api/v1/health", { signal });
}
