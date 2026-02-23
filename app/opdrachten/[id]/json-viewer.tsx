"use client";

import { Code } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { VisualJsonViewer } from "@/components/visual-json-viewer";
import { zodToVisualJsonSchema } from "@/src/lib/zod-json-schema";
import { unifiedJobSchema } from "@/src/schemas/job";

const jobSchema = zodToVisualJsonSchema(unifiedJobSchema, "unifiedJob") as object;

export function JsonViewer({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);

  // Extract the definitions-unwrapped schema for visual-json
  const schema = useMemo(() => {
    const s = jobSchema as Record<string, unknown>;
    // zod-to-json-schema wraps in { $ref, definitions } — extract the actual schema
    if (s.definitions && s.$ref) {
      const refKey = (s.$ref as string).replace("#/definitions/", "");
      return (s.definitions as Record<string, unknown>)[refKey] as object;
    }
    return jobSchema;
  }, []);

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
        <div className="mt-3">
          <VisualJsonViewer value={data} schema={schema} readOnly height={500} />
        </div>
      )}
    </div>
  );
}
