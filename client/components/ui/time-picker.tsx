"use client";

import { useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/*
 * Time field: type any time ("9:37", "9:37 pm", "21:37", "9pm", "0937") or pick one from a list of quarter hours.
 * Values are "HH:MM" (24-hour, "" = empty), shown in the user's own 12/24-hour style. Typing something that isn't a
 * time puts the previous value back on blur, so the value is always a real time. Enter commits, Escape reverts.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" from what the user typed, or null when it isn't a time. */
export function parseTime(text: string): string | null {
  const match = /^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*([ap])\.?\s*m?\.?$|^(\d{1,2})(?:[:.\s]?(\d{2}))?$/i.exec(text.trim());
  if (!match) return null;
  const hourText = match[1] ?? match[4];
  const minute = Number(match[2] ?? match[5] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  let hour = Number(hourText);
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === "p" ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(minute)}`;
}

/** "9:37 AM" (or "09:37" where 24-hour time is the norm) for an "HH:MM" value. */
export function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hour, minute));
}

/** Every 15 minutes of the day */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

type TimePickerProps = {
  id?: string;
  /** "HH:MM" (24-hour) or "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/** Field-like input (same look as DatePicker and TextField) with a list of quarter hours. */
function TimePicker({ id, value, onChange, placeholder = "e.g. 9:30 AM", disabled, className, ...aria }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  /** What's being typed; null when not editing (the formatted value is shown) */
  const [typing, setTyping] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = typing ?? (value ? formatTime(value) : "");

  function commit() {
    if (typing === null) return;
    const parsed = typing.trim() ? parseTime(typing) : "";
    if (parsed !== null && parsed !== value) onChange(parsed);
    setTyping(null);
  }

  function pick(next: string) {
    onChange(next);
    setTyping(null);
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          data-slot="time-picker"
          className={cn(
            "flex h-8 min-w-0 items-center rounded-sm border border-border-input bg-input text-sm transition-colors hover:bg-input-hovered pointer-coarse:h-10",
            "focus-within:border-focus focus-within:ring-1 focus-within:ring-focus",
            aria["aria-invalid"] && "border-danger-bold",
            disabled && "pointer-events-none border-transparent bg-disabled-bg text-disabled",
            className,
          )}
        >
          <Clock className="ml-2 size-4 shrink-0 text-subtle" aria-hidden />
          <input
            id={id}
            type="text"
            inputMode="text"
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={shown}
            aria-label={aria["aria-label"]}
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
            onChange={(event) => setTyping(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape" && typing !== null) {
                event.stopPropagation();
                setTyping(null);
              } else if (event.key === "ArrowDown" && event.altKey) {
                setOpen(true);
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-foreground outline-none placeholder:text-subtlest pointer-coarse:text-base"
          />
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Choose a time"
              className="flex h-full shrink-0 items-center rounded-r-sm px-1.5 text-subtle outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </PopoverPrimitive.Trigger>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="time-picker-content"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-44 rounded-sm bg-surface-overlay text-foreground shadow-overlay outline-none"
          onOpenAutoFocus={(event) => {
            // Scroll to (and focus) the chosen time, or the nearest quarter hour before it
            event.preventDefault();
            requestAnimationFrame(() => {
              const nearest = value ? QUARTER_HOURS.filter((slot) => slot <= value).at(-1) ?? QUARTER_HOURS[0] : "09:00";
              const option = listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${nearest}"]`);
              option?.scrollIntoView({ block: "center" });
              option?.focus();
            });
          }}
        >
          <div ref={listRef} role="listbox" aria-label="Times" className="max-h-64 overflow-y-auto py-1 scrollbar-thin"
            onKeyDown={(event) => {
              // Arrow keys move between times
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const options = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
              const index = options.indexOf(document.activeElement as HTMLButtonElement);
              options[Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
            }}>
            {QUARTER_HOURS.map((slot) => (
              <button
                key={slot}
                type="button"
                role="option"
                data-value={slot}
                aria-selected={slot === value}
                onClick={() => pick(slot)}
                className={cn(
                  "flex w-full items-center px-3 py-1.5 text-left text-sm outline-none hover:bg-neutral-subtle-hovered focus-visible:bg-neutral-subtle-hovered pointer-coarse:py-2.5",
                  slot === value && "bg-selected text-selected-text",
                )}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { TimePicker };
