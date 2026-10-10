import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

function PageHeader({
  className,
  title,
  breadcrumbs,
  description,
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("mb-4 flex flex-col gap-1", className)} {...props}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl leading-8 font-semibold text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-subtle">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export { PageHeader };
