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
        className="border-[#2d2d2d] bg-[#1e1e1e] text-[#6b6b6b] hover:text-[#ececec] hover:bg-[#2a2a2a] text-xs"
      >
        <Code className="h-3.5 w-3.5 mr-1.5" />
        {open ? "Verberg JSON" : "Toon JSON"}
      </Button>
      {open && (
        <pre className="mt-3 p-4 bg-[#0d0d0d] border border-[#2d2d2d] rounded-lg text-xs text-[#8e8e8e] overflow-x-auto max-h-[500px] overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
