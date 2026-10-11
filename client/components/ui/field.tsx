import { cn } from "@/lib/utils";

type FieldProps = {
  /** id of the input inside, so the label is clickable and read by screen readers */
  htmlFor: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error, Atlassian form layout. */
function Field({ htmlFor, label, required, hint, error, className, children }: FieldProps) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-subtle">
        {label}
        {required && (
          <span className="text-danger-text" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger-text" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-subtlest">{hint}</p>
      )}
    </div>
  );
}

export { Field };
