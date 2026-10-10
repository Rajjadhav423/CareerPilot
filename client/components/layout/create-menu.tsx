"use client";

import { Briefcase, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lozenge } from "@/components/ui/lozenge";

/** Jira's blue "+ Create" button. Items get enabled as features are built. */
export function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" aria-label="Create">
          <Plus />
          <span className="max-sm:hidden">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <Briefcase />
          <span className="flex-1">Job</span>
          <Lozenge>Phase 1</Lozenge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
