"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/*
 * Atlassian-style date picker: a field that opens a month calendar. Values are "YYYY-MM-DD" strings ("" = empty),
 * so they drop straight into forms and query strings. Keyboard: arrows move a day/week, PageUp/PageDown a month,
 * Home/End the week, Enter/Space picks, Escape closes.
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Local date ↔ "YYYY-MM-DD" (no time zones involved). */
function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromIso(value: string | undefined | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? date : null;
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
};

const monthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const displayDate = (date: Date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

type CalendarProps = {
  value: string;
  onSelect: (value: string) => void;
  /** Earliest / latest selectable day, "YYYY-MM-DD" */
  min?: string;
  max?: string;
};

/** A month grid. Exported for use outside the picker (e.g. an always-visible calendar). */
function Calendar({ value, onSelect, min, max }: CalendarProps) {
  const selected = fromIso(value);
  const minDate = fromIso(min);
  const maxDate = fromIso(max);
  const today = new Date();
  const [focused, setFocused] = useState<Date>(() => selected ?? (maxDate && maxDate < today ? maxDate : today));
  const grid = useRef<HTMLDivElement>(null);

  const disabled = (date: Date) =>
    (minDate !== null && toIso(date) < toIso(minDate)) || (maxDate !== null && toIso(date) > toIso(maxDate));

  const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  function moveFocus(next: Date) {
    setFocused(next);
    // Focus the new day after it renders
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(next)}"]`)?.focus());
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
      Home: () => addDays(focused, -focused.getDay()),
      End: () => addDays(focused, 6 - focused.getDay()),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveFocus(move());
    }
  }

  return (
    <div data-slot="calendar" className="flex w-72 flex-col gap-2 p-3 pointer-coarse:w-80">
      <div className="flex items-center justify-between">
        <Button variant="subtle" size="icon-compact" aria-label="Previous month" onClick={() => moveFocus(addMonths(focused, -1))}>
          <ChevronLeft />
        </Button>
        <p className="text-sm font-semibold" aria-live="polite">{monthLabel(focused)}</p>
        <Button variant="subtle" size="icon-compact" aria-label="Next month" onClick={() => moveFocus(addMonths(focused, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <div role="grid" aria-label={monthLabel(focused)} ref={grid} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day) => (
          <span key={day} role="columnheader" className="flex h-6 items-center justify-center text-xs font-semibold text-subtlest">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const iso = toIso(day);
          const isSelected = selected !== null && iso === toIso(selected);
          const isToday = iso === toIso(today);
          const outside = day.getMonth() !== focused.getMonth();
          const isDisabled = disabled(day);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-day={iso}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              tabIndex={iso === toIso(focused) ? 0 : -1}
              disabled={isDisabled}
              onClick={() => onSelect(iso)}
              onFocus={() => setFocused(day)}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-sm text-sm outline-none transition-colors pointer-coarse:h-10",
                "hover:bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-focus",
                outside && "text-subtlest",
                isToday && !isSelected && "font-semibold text-link",
                isSelected && "bg-selected font-semibold text-selected-text hover:bg-selected",
                isDisabled && "pointer-events-none text-disabled line-through",
              )}
            >
              {day.getDate()}
              {isToday && <span aria-hidden className="absolute bottom-1 h-0.5 w-3 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DatePickerProps = {
  id?: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/** Field-like trigger (same look as TextField) that opens a Calendar; a clear button empties it. */
function DatePicker({ id, value, onChange, min, max, placeholder = "Select a date", disabled, className, ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = fromIso(value);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div
        data-slot="date-picker"
        className={cn(
          "flex h-8 min-w-0 items-center rounded-sm border border-border-input bg-input text-sm transition-colors hover:bg-input-hovered pointer-coarse:h-10",
          "focus-within:border-focus focus-within:ring-1 focus-within:ring-focus",
          aria["aria-invalid"] && "border-danger-bold",
          disabled && "pointer-events-none border-transparent bg-disabled-bg text-disabled",
          className,
        )}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={aria["aria-label"]}
            aria-describedby={aria["aria-describedby"]}
            className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left outline-none pointer-coarse:text-base"
          >
            <CalendarDays className="size-4 shrink-0 text-subtle" aria-hidden />
            <span className={cn("truncate", date ? "text-foreground" : "text-subtlest")}>
              {date ? displayDate(date) : placeholder}
            </span>
          </button>
        </PopoverPrimitive.Trigger>
        {date && !disabled && (
          <Button variant="subtle" size="icon-compact" className="mr-0.5" aria-label="Clear date" onClick={() => onChange("")}>
            <X />
          </Button>
        )}
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="date-picker-content"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 rounded-sm bg-surface-overlay text-foreground shadow-overlay outline-none"
          onOpenAutoFocus={(event) => {
            // Focus the selected (or today's) day instead of the first button
            event.preventDefault();
            const content = event.currentTarget as HTMLElement;
            requestAnimationFrame(() => content.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')?.focus());
          }}
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            onSelect={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { Calendar, DatePicker };
