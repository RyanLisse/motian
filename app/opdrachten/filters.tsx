"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface FiltersProps {
  query: string;
  platform: string;
  platforms: string[];
  page: number;
  totalPages: number;
}

export function OpdrachtenFilters({
  query,
  platform,
  platforms,
  page,
  totalPages,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 when filters change (unless pagina is being set)
      if (!("pagina" in updates)) {
        params.delete("pagina");
      }
      startTransition(() => {
        router.push(`/opdrachten?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoeken op titel..."
            defaultValue={query}
            className="pl-9 bg-card border-border"
            onChange={(e) => {
              const value = e.target.value;
              // Debounce: only update after user stops typing
              const timeout = setTimeout(() => {
                updateParams({ q: value });
              }, 400);
              return () => clearTimeout(timeout);
            }}
          />
        </div>
        <Select
          value={platform || "all"}
          onValueChange={(value) =>
            updateParams({ platform: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-full sm:w-48 bg-card border-border">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle platformen</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {page} van {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => updateParams({ pagina: String(page - 1) })}
              className="border-border"
            >
              <ChevronLeft className="h-4 w-4" />
              Vorige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => updateParams({ pagina: String(page + 1) })}
              className="border-border"
            >
              Volgende
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
