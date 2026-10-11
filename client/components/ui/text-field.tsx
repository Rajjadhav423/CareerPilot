import { cn } from "@/lib/utils";

type TextFieldProps = React.ComponentProps<"input"> & {
  /** Icon shown inside the field on the left, e.g. a search icon. */
  elemBefore?: React.ReactNode;
};

/** Atlassian-style text input: grey border, blue border on focus. */
function TextField({ className, elemBefore, ...props }: TextFieldProps) {
  return (
    <div
      data-slot="text-field"
      className={cn(
        "flex h-8 pointer-coarse:h-10 items-center gap-2 rounded-sm border border-border-input bg-input px-2 text-sm transition-colors hover:bg-input-hovered focus-within:border-focus focus-within:ring-1 focus-within:ring-focus has-[[aria-invalid=true]]:border-danger-bold has-[:disabled]:pointer-events-none has-[:disabled]:border-transparent has-[:disabled]:bg-disabled-bg",
        className,
      )}
    >
      {elemBefore && (
        <span className="flex shrink-0 text-subtle [&_svg]:size-4" aria-hidden>
          {elemBefore}
        </span>
      )}
      <input
        // 16px on touch devices: iOS Safari zooms into any input smaller than that.
        className="h-full min-w-0 flex-1 bg-transparent text-foreground outline-none pointer-coarse:text-base placeholder:text-subtlest disabled:text-disabled disabled:placeholder:text-disabled"
        {...props}
      />
    </div>
  );
}

export { TextField };
