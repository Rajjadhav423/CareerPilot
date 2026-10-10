import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Horizontally scrolling Kanban board (Jira board layout). */
function Board({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="board"
      className={cn(
        // Phones: each column is most of the screen and snaps into place as you swipe.
        "flex snap-x snap-mandatory items-start gap-2 overflow-x-auto pb-4 sm:snap-none",
        className,
      )}
      {...props}
    />
  );
}

type BoardColumnProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: string;
  count?: number;
  /** Shown when the column has no cards. */
  empty?: React.ReactNode;
};

function BoardColumn({ className, title, count, empty, children, ...props }: BoardColumnProps) {
  return (
    <section
      data-slot="board-column"
      aria-label={title}
      className={cn(
        "flex w-[85%] shrink-0 snap-start flex-col rounded-lg bg-surface-sunken sm:w-68",
        className,
      )}
      {...props}
    >
      <header className="flex h-11 items-center gap-2 px-3">
        <h3 className="truncate text-xs font-semibold text-subtle uppercase">{title}</h3>
        {count !== undefined && <Badge>{count}</Badge>}
      </header>
      <div className="flex min-h-80 flex-col gap-1 px-1.5 pb-1.5">
        {children}
        {!children && empty && (
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center text-xs text-subtlest">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

/** A card inside a column. Clickable cards should render as a link or button child. */
function BoardCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="board-card"
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-surface-raised p-3 text-sm shadow-raised transition-colors hover:bg-surface-raised-hovered",
        className,
      )}
      {...props}
    />
  );
}

export { Board, BoardColumn, BoardCard };
