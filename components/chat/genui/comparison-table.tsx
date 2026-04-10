"use client";
import { Columns3 } from "lucide-react";
import { memo } from "react";
import {
  genuiDisclosureSummaryClassName,
  getToolErrorMessage,
  isToolError,
  useGenUIMobile,
} from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type ComparisonOutput = {
  type: "comparison";
  title?: string;
  columns: string[];
  items: Array<{ label: string; values: Record<string, string | number | null> }>;
};

function isComparisonOutput(o: unknown): o is ComparisonOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "columns" in o &&
    "items" in o &&
    Array.isArray((o as ComparisonOutput).columns) &&
    Array.isArray((o as ComparisonOutput).items)
  );
}

export const ComparisonTable = memo(function ComparisonTable({ output }: { output: unknown }) {
  const isMobile = useGenUIMobile();

  if (isToolError(output)) {
    return (
      <ToolErrorBlock message={getToolErrorMessage(output, "Vergelijking niet beschikbaar")} />
    );
  }
  if (!isComparisonOutput(output)) return null;
  if (output.items.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4" />
          <span>Geen gegevens om te vergelijken</span>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="my-2 rounded-lg border border-border bg-card p-3">
        {output.title && (
          <div className="mb-3 flex items-center gap-2">
            <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{output.title}</span>
          </div>
        )}
        <div className="space-y-2">
          {output.items.map((item) => (
            <details
              key={item.label}
              className="rounded-md border border-border/70 bg-background/70"
            >
              <summary className={genuiDisclosureSummaryClassName}>
                <span>{item.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {output.columns.length} waarden
                </span>
              </summary>
              <div className="space-y-2 border-t border-border/70 p-3">
                {output.columns.map((col) => (
                  <div key={col} className="rounded-md bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {col}
                    </p>
                    <p className="mt-1 break-words text-sm text-foreground">
                      {String(item.values[col] ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden">
      {output.title && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">{output.title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground" />
              {output.columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.items.map((item) => (
              <tr key={item.label} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                  {item.label}
                </td>
                {output.columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-muted-foreground">
                    {item.values[col] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
