import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/** Atlassian-style button. `default` is the bordered neutral button (e.g. Jira's filter buttons). */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent font-medium transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled aria-disabled:pointer-events-none aria-disabled:bg-disabled-bg aria-disabled:text-disabled [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-inverse hover:bg-brand-hovered active:bg-brand-pressed",
        default:
          "border-border bg-transparent text-subtle hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed",
        subtle:
          "bg-transparent text-subtle hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed disabled:bg-transparent",
        danger: "bg-danger-bold text-inverse hover:bg-danger-bold-hovered",
        warning: "bg-warning-bold text-warning-inverse hover:bg-warning-bold-hovered",
        link: "h-auto px-0 bg-transparent text-link underline-offset-2 hover:underline disabled:bg-transparent",
      },
      size: {
        default: "h-8 px-3 text-sm",
        compact: "h-6 px-2 text-sm",
        icon: "size-8",
        "icon-compact": "size-6",
      },
      isSelected: {
        true: "border-border-selected bg-selected text-selected-text hover:bg-selected-hovered active:bg-selected-pressed",
        false: "",
      },
    },
    defaultVariants: { variant: "default", size: "default", isSelected: false },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean;
    /** Render the child element (e.g. a Next.js <Link>) with button styles. */
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  isSelected,
  isLoading = false,
  asChild = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, isSelected }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      aria-pressed={isSelected ?? undefined}
      className={classes}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="invisible inline-flex items-center gap-1.5">{children}</span>
          <Spinner size="sm" className="absolute" />
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
