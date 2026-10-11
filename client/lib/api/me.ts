import { apiFetch } from "./client";

/** Mirrors com.careerpilot.backend.user.MeController.MeResponse */
export type Me = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export function getMe(token: string | null) {
  return apiFetch<Me>("/api/v1/me", { token });
}
