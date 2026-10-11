import { Spinner } from "@/components/ui/spinner";

/** Shown for a moment while Clerk's sign-in/sign-up form loads. */
export function AuthCardFallback() {
  return (
    <div className="flex h-96 w-full max-w-100 items-center justify-center rounded-lg border border-border bg-surface-raised text-subtle shadow-raised">
      <Spinner size="lg" label="Loading sign-in" />
    </div>
  );
}
