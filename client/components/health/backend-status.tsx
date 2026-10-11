"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { API_BASE_URL, ApiError } from "@/lib/api/client";
import { getHealth, type HealthResponse } from "@/lib/api/health";
import { getMe, type Me } from "@/lib/api/me";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

type Status =
  | { kind: "loading" }
  | { kind: "up"; data: HealthResponse; account: AccountCheck; checkedAt: Date }
  | { kind: "down"; message: string; checkedAt: Date };

/** Whether the API accepts our Clerk session token (GET /api/v1/me). */
type AccountCheck = { ok: true; me: Me } | { ok: false; message: string };

async function loadStatus(getToken: () => Promise<string | null>, signal?: AbortSignal): Promise<Status> {
  try {
    const data = await getHealth(signal);
    let account: AccountCheck;
    try {
      account = { ok: true, me: await getMe(await getToken()) };
    } catch (error) {
      account = { ok: false, message: error instanceof ApiError ? error.message : "Unexpected error." };
    }
    return { kind: "up", data, account, checkedAt: new Date() };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Unexpected error.";
    return { kind: "down", message, checkedAt: new Date() };
  }
}

export function BackendStatus() {
  const { getToken, isLoaded } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    // Wait for Clerk: before it loads there is no session token yet.
    if (!isLoaded) return;
    const controller = new AbortController();
    loadStatus(getToken, controller.signal).then((next) => {
      if (!controller.signal.aborted) setStatus(next);
    });
    return () => controller.abort();
  }, [getToken, isLoaded]);

  function refresh() {
    setStatus({ kind: "loading" });
    loadStatus(getToken).then(setStatus);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Backend status</CardTitle>
          <CardDescription>Spring Boot API at {API_BASE_URL}</CardDescription>
        </div>
        <Button
          variant="subtle"
          size="icon"
          aria-label="Check again"
          title="Check again"
          onClick={refresh}
          disabled={status.kind === "loading"}
        >
          <RefreshCw />
        </Button>
      </CardHeader>
      <CardContent>
        {status.kind === "loading" && (
          <p className="flex items-center gap-2 text-subtle">
            <Spinner size="sm" /> Checking…
          </p>
        )}

        {status.kind === "up" && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-subtle">Status</dt>
            <dd>
              <Lozenge appearance="success">{status.data.status}</Lozenge>
            </dd>
            <dt className="text-subtle">Service</dt>
            <dd className="font-mono text-xs leading-5">{status.data.service}</dd>
            <dt className="text-subtle">Signed in to API</dt>
            <dd className="min-w-0">
              {status.account.ok ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Lozenge appearance="success">Yes</Lozenge>
                  <span className="truncate text-subtle">
                    {status.account.me.email ?? status.account.me.displayName ?? "your account"}
                  </span>
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Lozenge appearance="removed">No</Lozenge>
                  <span className="text-subtle">{status.account.message}</span>
                </span>
              )}
            </dd>
            <dt className="text-subtle">Last checked</dt>
            <dd>{status.checkedAt.toLocaleTimeString()}</dd>
          </dl>
        )}

        {status.kind === "down" && (
          <SectionMessage appearance="error" title="Backend is not reachable">
            <p>{status.message}</p>
            <p className="mt-1 text-subtle">
              Start it with <code className="font-mono text-xs">gradlew.bat bootRun</code> in the{" "}
              <code className="font-mono text-xs">server</code> folder, then check again.
            </p>
          </SectionMessage>
        )}
      </CardContent>
    </Card>
  );
}
