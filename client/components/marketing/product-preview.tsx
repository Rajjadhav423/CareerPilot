import { Board, BoardCard, BoardColumn } from "@/components/ui/board";
import { Lozenge } from "@/components/ui/lozenge";

/** Illustration of the job board, built from the real board components. Example data only. */
const columns = [
  {
    title: "Saved",
    cards: [
      { title: "Backend Engineer", company: "Northwind Labs · Bengaluru", tag: "Backend" },
      { title: "Platform Engineer", company: "Globex Cloud · Remote", tag: "DevOps / SRE" },
    ],
  },
  {
    title: "Applied",
    cards: [{ title: "Software Engineer II", company: "Acme Payments · Pune", tag: "General" }],
  },
  {
    title: "Interview",
    cards: [{ title: "Senior Java Developer", company: "Initech · Hyderabad", tag: "Backend" }],
  },
];

export function ProductPreview() {
  return (
    <div
      aria-hidden
      className="pointer-events-none rounded-xl border border-border bg-surface p-3 shadow-overlay select-none sm:p-4"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-danger-bold/70" />
        <span className="size-2.5 rounded-full bg-warning-bold/70" />
        <span className="size-2.5 rounded-full bg-success-bold/70" />
        <span className="ml-2 text-xs text-subtlest">Job board (example)</span>
      </div>
      <Board className="snap-none pb-0">
        {columns.map((column) => (
          <BoardColumn key={column.title} title={column.title} count={column.cards.length} className="w-[calc((100%-1rem)/3)] min-w-40 [&>div]:min-h-40">
            {column.cards.map((card) => (
              <BoardCard key={card.title} className="gap-1.5">
                <p className="font-medium">{card.title}</p>
                <p className="text-xs text-subtle">{card.company}</p>
                <div>
                  <Lozenge>{card.tag}</Lozenge>
                </div>
              </BoardCard>
            ))}
          </BoardColumn>
        ))}
      </Board>
    </div>
  );
}
