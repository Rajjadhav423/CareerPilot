"use client";

import { useRef } from "react";
import { Braces } from "lucide-react";

import type { MergeField } from "@/lib/api/templates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MergeFieldMenuProps = {
  fields: MergeField[];
  /** Where the field will go, shown in the menu heading ("subject" / "body"). */
  target: string;
  onInsert: (field: MergeField) => void;
  disabled?: boolean;
};

/** "Insert field" menu listing the server's allowlist; picking one inserts its {{placeholder}} at the cursor. */
export function MergeFieldMenu({ fields, target, onInsert, disabled }: MergeFieldMenuProps) {
  const inserted = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="compact" disabled={disabled || fields.length === 0}>
          <Braces /> Insert field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-72 overflow-y-auto"
        onCloseAutoFocus={(event) => {
          // After an insert the caller puts focus back in the text field, after the new field
          if (inserted.current) event.preventDefault();
          inserted.current = false;
        }}
      >
        <DropdownMenuLabel>Insert into {target}</DropdownMenuLabel>
        {fields.map((field) => (
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
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
