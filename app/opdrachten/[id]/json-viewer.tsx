"use client";

import { useState } from "react";
import { Code } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JsonViewer({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
      >
        <Code className="h-3.5 w-3.5 mr-1.5" />
        {open ? "Verberg JSON" : "Toon JSON"}
      </Button>
      {open && (
        <pre className="mt-3 p-4 bg-background border border-border rounded-lg text-xs text-muted-foreground overflow-x-auto max-h-[500px] overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
