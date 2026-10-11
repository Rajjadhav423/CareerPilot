"use client";

import { useState } from "react";
import { Briefcase, Plus } from "lucide-react";

import { AddJobDialog } from "@/components/jobs/add-job-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Jira's blue "+ Create" button. */
export function CreateMenu() {
  const [addJobOpen, setAddJobOpen] = useState(false);

  return (
    <>
      {/* modal={false}: lets the dialog take focus cleanly after the menu closes */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="primary" aria-label="Create">
            <Plus />
            <span className="max-sm:hidden">Create</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setAddJobOpen(true)}>
            <Briefcase />
            Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddJobDialog open={addJobOpen} onOpenChange={setAddJobOpen} />
    </>
  );
}
