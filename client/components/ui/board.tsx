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
  /**
   * Jira-style: the column is one screen tall (under the top bar and a sticky page header) and its cards
   * scroll inside it while the column header stays put. All columns get the same height (override with --board-column-h).
   */
  scrollable?: boolean;
  /** A card is being dragged over this column (drag and drop): highlighted as the drop target. */
  isDropTarget?: boolean;
};

function BoardColumn({ className, title, count, empty, scrollable = false, isDropTarget = false, children, ...props }: BoardColumnProps) {
  return (
    <section
      data-slot="board-column"
      aria-label={title}
      className={cn(
        "flex w-[85%] shrink-0 snap-start flex-col rounded-lg bg-surface-sunken transition-colors sm:w-68",
        isDropTarget && "bg-selected ring-2 ring-focus",
        scrollable && "h-(--board-column-h,calc(100dvh-13rem)) min-h-80",
        className,
      )}
      {...props}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 px-3">
        <h3 className="truncate text-xs font-semibold text-subtle uppercase">{title}</h3>
        {count !== undefined && <Badge>{count}</Badge>}
      </header>
      <div className={cn("flex min-h-80 flex-col gap-1 px-1.5 pb-1.5",
        scrollable && "min-h-0 flex-1 overflow-y-auto scrollbar-thin")}>
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

type BoardCardProps = React.ComponentProps<"div"> & {
  /** This card's place while a copy of it is dragged (drag and drop): shown faded */
  isDragging?: boolean;
  /** The copy that follows the pointer while dragging: lifted and slightly tilted, like Jira */
  isOverlay?: boolean;
};

/** A card inside a column. Clickable cards should render as a link or button child. */
function BoardCard({ className, isDragging = false, isOverlay = false, ...props }: BoardCardProps) {
  return (
    <div
      data-slot="board-card"
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-surface-raised p-3 text-sm shadow-raised transition-colors hover:bg-surface-raised-hovered",
        isDragging && "opacity-40",
        isOverlay && "rotate-2 cursor-grabbing shadow-overlay",
        className,
      )}
      {...props}
    />
  );
}

export { Board, BoardColumn, BoardCard };
