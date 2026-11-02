import { cn } from "@/lib/utils";

/**
 * The one table look across the app, Jira's List view: a framed grid (8px radius) with a sunken header, column
 * dividers in the header, a line between rows, 40px rows with 12px side padding, a subtle hover and the blue selected
 * state. The frame scrolls horizontally on small screens.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-lg border border-border bg-surface">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:hover:bg-transparent", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child>td]:border-b-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "outline-none transition-colors hover:bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        "data-[state=selected]:bg-selected data-[state=selected]:hover:bg-selected-hovered",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 border-b border-border bg-surface-sunken px-3 text-left align-middle text-xs font-bold whitespace-nowrap text-subtle not-last:border-r",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("h-10 border-b border-border px-3 align-middle", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
