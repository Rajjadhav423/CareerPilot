export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/**
 * Error thrown for any failed API call. `status` is 0 when the server could not be reached.
 * `code` and `fieldErrors` come from the backend's ProblemDetail body when present.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  /** Clerk session token. Required for every endpoint except health. */
  token?: string | null;
  /** Sent as JSON. */
  json?: unknown;
};

type ProblemDetail = { detail?: string; code?: string; errors?: Record<string, string> };

export async function apiFetch<T>(path: string, { token, json, ...init }: ApiFetchOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      body: json === undefined ? undefined : JSON.stringify(json),
      headers: {
        Accept: "application/json",
        ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(`Cannot reach the CareerPilot server at ${API_BASE_URL}.`, 0);
  }

  if (response.status === 401) {
    throw new ApiError("Your session has expired. Please sign in again.", 401, "UNAUTHENTICATED");
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemDetail;
    throw new ApiError(
      problem.detail ?? `Request failed with status ${response.status}.`,
      response.status,
      problem.code,
      problem.errors ?? {},
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
