import { cn } from "@/lib/utils";

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

function EmptyState({ className, icon, title, description, actions, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center px-6 py-10 text-center", className)}
      {...props}
    >
      {icon && <div className="mb-4 text-subtlest [&_svg]:size-10">{icon}</div>}
      <h4 className="text-base font-semibold text-foreground">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm text-subtle">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export { EmptyState };
