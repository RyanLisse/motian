"use client";

import { AlertCircle } from "lucide-react";

export function ToolErrorBlock({ message }: { message: string }) {
  return (
    <div className="my-1.5 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
