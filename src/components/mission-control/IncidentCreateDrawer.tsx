"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { IncidentCreateForm, type IncidentCreatePayload } from "./IncidentCreateForm";
import type { Station } from "@/lib/mission-control/types";
import { ShieldAlert } from "lucide-react";

export function IncidentCreateDrawer({
  open,
  onOpenChange,
  stations,
  operatorName,
  isPending,
  onSubmit,
  selectedStationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stations: Station[];
  operatorName: string;
  isPending: boolean;
  onSubmit: (payload: IncidentCreatePayload) => void;
  selectedStationId?: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={true}
        className="w-[24rem] max-w-[24rem] border-l border-cyan-500/20 bg-slate-950/98 backdrop-blur-md p-0 text-slate-100 flex flex-col h-full shadow-[0_0_40px_rgba(6,182,212,0.25)] z-[9999]"
      >
        <SheetHeader className="p-4 border-b border-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
              <ShieldAlert className="size-4 animate-pulse" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold uppercase tracking-wider text-slate-50">
                New Incident
              </SheetTitle>
              <SheetDescription className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                Mission Control Intake
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto p-4">
          <IncidentCreateForm
            stations={stations}
            operatorName={operatorName}
            isPending={isPending}
            onSubmit={onSubmit}
            defaultStationId={selectedStationId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
