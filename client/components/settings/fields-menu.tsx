"use client";

import Link from "next/link";
import { Braces, Settings } from "lucide-react";

import { placeholderOf } from "@/lib/api/fields";
import { ROUTES } from "@/lib/routes";
import { useUserFields } from "@/lib/settings/use-user-fields";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

type FieldsMenuProps = {
  /** Called with the placeholder, e.g. "{{github}}" */
  onPick: (placeholder: string) => void;
  /** Explains what picking does, e.g. "Inserted at the cursor" */
  hint: string;
};

/** The user's saved details (Settings), to drop into a resume as {{key}}. */
export function FieldsMenu({ onPick, hint }: FieldsMenuProps) {
  const fields = useUserFields();

  return (
    <DropdownMenu>
      <Tooltip content="Your saved details, like {{github}}">
        <DropdownMenuTrigger asChild>
          <Button size="compact" variant="subtle" aria-label="Saved details">
            <Braces /> <span className="@max-md:sr-only">Details</span>
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>{hint}</DropdownMenuLabel>
        {fields.data?.length ? (
          fields.data.map((field) => (
            <DropdownMenuItem key={field.key} onSelect={() => onPick(placeholderOf(field.key))}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{field.label}</span>
                  <code className="shrink-0 font-mono text-xs text-subtle">{placeholderOf(field.key)}</code>
                </span>
                <span className="truncate text-xs text-subtlest">{field.value}</span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-1.5 text-sm text-subtle">
            {fields.isPending ? "Loading…" : "No saved details yet."}
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.settings}>
            <Settings /> Manage details
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
