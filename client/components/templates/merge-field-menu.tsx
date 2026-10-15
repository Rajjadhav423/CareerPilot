"use client";

import { useRef } from "react";
import Link from "next/link";
import { Braces, Plus, Settings } from "lucide-react";

import type { MergeField } from "@/lib/api/templates";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MergeFieldMenuProps = {
  /** Built-in fields (job, account) */
  fields: MergeField[];
  /** The user's saved details (Settings), as fields */
  details?: MergeField[];
  /** Where the field will go, shown in the menu heading ("subject" / "body"). */
  target: string;
  onInsert: (field: MergeField) => void;
  /** Opens "Add a detail" (saved in Settings, then inserted) */
  onAddDetail?: () => void;
  disabled?: boolean;
};

/**
 * "Insert field" menu: built-in fields, then the user's saved details; picking one inserts its {{placeholder}} at
 * the cursor. A new detail can be added from here too.
 */
export function MergeFieldMenu({ fields, details = [], target, onInsert, onAddDetail, disabled }: MergeFieldMenuProps) {
  const inserted = useRef(false);
  const item = (field: MergeField) => (
    <DropdownMenuItem
      key={field.key}
      onSelect={() => {
        inserted.current = true;
        onInsert(field);
      }}
    >
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{field.label}</span>
        <span className="truncate font-mono text-xs text-subtlest">{field.placeholder}</span>
      </div>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="compact" disabled={disabled || fields.length === 0}>
          <Braces /> Insert field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-96 w-72 overflow-y-auto"
        onCloseAutoFocus={(event) => {
          // After an insert the caller puts focus back in the text field, after the new field
          if (inserted.current) event.preventDefault();
          inserted.current = false;
        }}
      >
        <DropdownMenuLabel>Insert into {target}</DropdownMenuLabel>
        {fields.map(item)}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Your details</DropdownMenuLabel>
        {details.length > 0 ? details.map(item) : (
          <p className="px-2 pb-1 text-xs text-subtle">GitHub, LinkedIn, resume link… saved once, used in every email.</p>
        )}
        {onAddDetail && (
          <DropdownMenuItem onSelect={onAddDetail}>
            <Plus /> Add a detail
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={ROUTES.settings}>
            <Settings /> Manage details
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
