"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Briefcase, Plus, Search } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Job } from "@/lib/api/jobs";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useJobs, useUpdateJob } from "@/lib/jobs/use-jobs";
import { ROUTES } from "@/lib/routes";
import { Board, BoardColumn } from "@/components/ui/board";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { AddJobDialog } from "./add-job-dialog";
import { JobCard } from "./job-card";

function groupByStatus(jobs: Job[]) {
  const groups = Object.fromEntries(JOB_STATUSES.map((s) => [s.id, [] as Job[]])) as Record<JobStatus, Job[]>;
  for (const job of jobs) groups[job.status]?.push(job);
  return groups;
}

const statusLabel = (id: unknown) => JOB_STATUSES.find((s) => s.id === id)?.label ?? String(id);

/** What screen readers hear while a card is dragged with the keyboard (Space to lift, arrows to move, Space to drop). */
function announcements(jobs: Job[]): Announcements {
  const title = (id: unknown) => jobs.find((job) => job.id === id)?.title ?? "Job";
  return {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} is over ${statusLabel(over.id)}.` : `${title(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} moved to ${statusLabel(over.id)}.` : `${title(active.id)} was dropped.`),
    onDragCancel: ({ active }) => `Moving ${title(active.id)} was cancelled.`,
  };
}

/** A status column that accepts dropped cards. */
function DroppableColumn({ status, count, children }: { status: JobStatus; count: number; children?: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: status });
  // Highlight only a different column than the card's own
  const fromHere = active?.data.current?.status === status;
  return (
    <BoardColumn ref={setNodeRef} title={statusLabel(status)} count={count} empty="No jobs" scrollable
      isDropTarget={isOver && !fromHere}>
      {children}
    </BoardColumn>
  );
}

/** A job card that can be dragged to another column. */
function DraggableJob({ job }: { job: Job }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: job.id, data: { status: job.status } });
  /*
   * React events bubble through portals: typing Space in the email dialog (opened from this card's ⋯ menu) or
   * pressing the mouse inside it would otherwise reach these listeners and pick the card up. Only start a drag from
   * the card itself: pointer events from inside its own DOM, and keys only when the card has focus (not its link or
   * ⋯ button, whose Space/Enter must keep working).
   */
  const fromCard = (event: React.SyntheticEvent) => event.currentTarget.contains(event.target as Node);
  const dragListeners = {
    onMouseDown: (event: React.MouseEvent) => fromCard(event) && listeners?.onMouseDown?.(event),
    onTouchStart: (event: React.TouchEvent) => fromCard(event) && listeners?.onTouchStart?.(event),
    onKeyDown: (event: React.KeyboardEvent) => event.target === event.currentTarget && listeners?.onKeyDown?.(event),
  };
  return (
    <div ref={setNodeRef} {...attributes} {...dragListeners} className="cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <JobCard job={job} isDragging={isDragging} />
    </div>
  );
}

export function JobBoard() {
  const { data: jobs, isPending, error } = useJobs();
  const [addOpen, setAddOpen] = useState(false);
  const updateJob = useUpdateJob();
  const [dragged, setDragged] = useState<Job | null>(null);
  const sensors = useSensors(
    // A drag starts after 6px of movement, so clicks on the job link and ⋯ menu still work
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press and hold, so a swipe still scrolls the board
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your jobs">
        {error instanceof ApiError ? error.message : "Unexpected error."}
      </SectionMessage>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your board…
      </div>
    );
  }

  const groups = groupByStatus(jobs);

  function onDragStart({ active }: DragStartEvent) {
    setDragged(jobs!.find((job) => job.id === active.id) ?? null);
  }

  /** Dropped on another column: the card moves there at once (optimistic) and is saved. */
  function onDragEnd({ active, over }: DragEndEvent) {
    setDragged(null);
    const job = jobs!.find((j) => j.id === active.id);
    const status = over?.id as JobStatus | undefined;
    if (job && status && status !== job.status) updateJob.mutate({ id: job.id, input: { status } });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle">
          {jobs.length === 0 ? "No jobs yet" : `${jobs.length} active ${jobs.length === 1 ? "job" : "jobs"}`}
        </p>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus /> Add job
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="Your board is empty"
          description="Save openings from Find jobs, or add one you found elsewhere. Then move them along as your applications progress."
          actions={
            <>
              <Button asChild variant="primary">
                <Link href={ROUTES.discover}>
                  <Search /> Find jobs
                </Link>
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add job
              </Button>
            </>
          }
        />
      ) : (
        <DndContext id="job-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}
          accessibility={{ announcements: announcements(jobs) }}>
          <Board>
            {JOB_STATUSES.map((status) => (
              <DroppableColumn key={status.id} status={status.id} count={groups[status.id].length}>
                {groups[status.id].length > 0
                  ? groups[status.id].map((job) => <DraggableJob key={job.id} job={job} />)
                  : undefined}
              </DroppableColumn>
            ))}
          </Board>
          {/* The copy that follows the pointer */}
          <DragOverlay dropAnimation={null}>
            {dragged && <JobCard job={dragged} isOverlay />}
          </DragOverlay>
        </DndContext>
      )}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
