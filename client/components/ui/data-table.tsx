"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactTable, Row, RowData, TableFeatures } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Sorting and selection APIs exist only when the caller registers those features; read them when present. */
type MaybeSortable = {
  getCanSort?: () => boolean;
  getIsSorted?: () => false | "asc" | "desc";
  getToggleSortingHandler?: () => ((event: unknown) => void) | undefined;
};
const isSelected = (row: object) => (row as { getIsSelected?: () => boolean }).getIsSelected?.() ?? false;

type DataTableProps<TFeatures extends TableFeatures, TData extends RowData> = {
  /** A table from TanStack's useTable; sorting, filtering and selection come from the features it registers. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any state selector the caller chose
  table: ReactTable<TFeatures, TData, any>;
  /** One row as a card in the narrow layout (phones, or a narrow content area). */
  renderCard: (row: Row<TFeatures, TData>) => React.ReactNode;
  /** Shown instead of rows when there are none (e.g. nothing matches a search). */
  empty?: React.ReactNode;
  /** Accessible name for the table and the card list. */
  label: string;
  className?: string;
  /** Shown under the table and card list, e.g. a count or a "+ Create" row. */
  footer?: React.ReactNode;
};

/**
 * TanStack-driven data list: a table on wide containers and a card list on narrow ones, from the same sorted and
 * filtered rows. Uses a container query, so it follows the space the sidebar leaves rather than the screen width.
 * Columns opt into sorting through the table's sorting feature; their headers become buttons.
 */
function DataTable<TFeatures extends TableFeatures, TData extends RowData>(
  { table, renderCard, empty, label, className, footer }: DataTableProps<TFeatures, TData>,
) {
  const rows = table.getRowModel().rows;

  return (
    <div data-slot="data-table" className={cn("@container", className)}>
      {rows.length === 0 && empty}

      {rows.length > 0 && (
        <ul aria-label={label} className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface @3xl:hidden">
          {rows.map((row) => (
            <li key={row.id} data-state={isSelected(row) ? "selected" : undefined} className="px-3 py-3 data-[state=selected]:bg-selected">
              {renderCard(row)}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="hidden @3xl:block">
          <Table aria-label={label}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                    const column = header.column as unknown as MaybeSortable;
                    const canSort = column.getCanSort?.() ?? false;
                    const sorted = canSort ? (column.getIsSorted?.() ?? false) : false;
                    return (
                      <TableHead
                        key={header.id}
                        className={meta?.headerClassName}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          // Atlassian's sortable header: just the label; the arrow shows on hover/focus or when sorted
                          <button
                            type="button"
                            onClick={column.getToggleSortingHandler?.()}
                            className="group/sort inline-flex items-center gap-1 rounded-xs font-bold outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:min-h-8"
                          >
                            <table.FlexRender header={header} />
                            {sorted === "asc" ? <ArrowUp className="size-3.5" aria-hidden />
                              : sorted === "desc" ? <ArrowDown className="size-3.5" aria-hidden />
                                : (
                                  <ArrowUpDown
                                    className="size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 pointer-coarse:opacity-60"
                                    aria-hidden
                                  />
                                )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-state={isSelected(row) ? "selected" : undefined}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef.meta as DataTableColumnMeta | undefined)?.cellClassName}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {footer}
    </div>
  );
}

/** Per-column styling for DataTable, set as `meta` on a column definition. */
type DataTableColumnMeta = { headerClassName?: string; cellClassName?: string };

export { DataTable, type DataTableColumnMeta };
