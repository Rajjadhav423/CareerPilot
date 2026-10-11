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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await apiRequest(path, "application/json", options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** For non-JSON responses (PDF downloads, HTML previews). Errors are still ProblemDetail JSON → ApiError. */
export async function apiFetchResponse(path: string, accept: string, options: ApiFetchOptions = {}): Promise<Response> {
  return apiRequest(path, accept, options);
}

async function apiRequest(path: string, accept: string, { token, json, ...init }: ApiFetchOptions): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      body: json === undefined ? undefined : JSON.stringify(json),
      headers: {
        Accept: accept,
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
  return response;
}

/** Saves a downloaded file using the server's suggested name (Content-Disposition), falling back to `fallbackName`. */
export async function saveResponseAsFile(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : plain ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser (notably iOS Safari) time to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
