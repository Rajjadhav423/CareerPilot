import { cn } from "@/lib/utils";

/**
 * Atlassian Dynamic Table look (values from @atlaskit/dynamic-table): no outer frame, a 2px rule under the header and
 * under the last row, no lines between rows, 4px × 8px cell padding with the first and last columns flush to the
 * edges, a subtle hover and the blue selected state. The wrapper scrolls horizontally on small screens.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom border-b-2 border-border text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b-2 [&_tr]:border-border [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
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
        "px-2 py-1 text-left align-middle text-xs font-bold whitespace-nowrap text-subtle first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-2 py-1 align-middle first:pl-0 last:pr-0", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
