"use client";

import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useSidebar } from "./app-shell";

export function SidebarToggle() {
  const { toggle } = useSidebar();
  return (
    <Tooltip content="Toggle sidebar">
      <Button
        variant="subtle"
        size="icon"
        aria-label="Toggle sidebar"
        aria-controls="app-sidebar"
        onClick={toggle}
      >
        <PanelLeft />
      </Button>
    </Tooltip>
  );
}
