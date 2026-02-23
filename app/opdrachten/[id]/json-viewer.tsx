"use client";

import { Code, X } from "lucide-react";
import { useMemo, useState } from "react";
import { zodToVisualJsonSchema } from "@/src/lib/zod-json-schema";
import { unifiedJobSchema } from "@/src/schemas/job";
import { Button } from "@/components/ui/button";
import { VisualJsonViewer } from "@/components/visual-json-viewer";

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
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
      >
        <Code className="h-3.5 w-3.5 mr-1.5" />
        Toon JSON
      </Button>

      {/* Full-screen overlay modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative z-10 w-[90vw] max-w-6xl h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  JSON Data — {(data as { title?: string }).title || "Vacancy"}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Editor fills remaining space */}
            <div className="flex-1 min-h-0">
              <VisualJsonViewer
                value={data}
                schema={schema}
                readOnly
                height="100%"
                width="100%"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
