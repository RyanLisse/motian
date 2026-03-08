"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenStatus,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
} from "@/src/lib/opdrachten-filters";

const PROVINCES = [
  "Noord-Holland",
  "Zuid-Holland",
  "Utrecht",
  "Noord-Brabant",
  "Gelderland",
  "Overijssel",
  "Limburg",
  "Friesland",
  "Groningen",
  "Drenthe",
  "Flevoland",
  "Zeeland",
];

const CONTRACT_TYPES = [
  { value: "freelance", label: "Freelance" },
  { value: "interim", label: "Interim" },
  { value: "vast", label: "Vast" },
  { value: "opdracht", label: "Opdracht" },
];

interface FiltersProps {
  query: string;
  platform: string;
  platforms: string[];
  endClient: string;
  endClients: string[];
  status: string;
  provincie: string;
  tariefMin: string;
  tariefMax: string;
  contractType: string;
  page: number;
  limit: number;
  totalPages: number;
}

export function OpdrachtenFilters({
  query,
  platform,
  platforms,
  endClient,
  endClients,
  status,
  provincie,
  tariefMin,
  tariefMax,
  contractType,
  page,
  limit,
  totalPages,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (key === "pagina") params.delete("page");
        if (key === "limit") params.delete("perPage");
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      if (!("pagina" in updates)) {
        params.delete("pagina");
        params.delete("page");
      }
      startTransition(() => {
        const query = params.toString();
        router.push(query ? `/opdrachten?${query}` : "/opdrachten");
      });
    },
    [router, searchParams],
  );

  const normalizedStatus = normalizeOpdrachtenStatus(status);

  return (
    <div className="w-full bg-secondary border-b border-border px-4 md:px-6 lg:px-8 py-3">
      <div className="flex flex-col lg:flex-row items-center gap-3">
        {/* Search input group */}
        <div className="flex w-full lg:w-auto flex-1 items-center gap-0 border border-border rounded-lg bg-card overflow-hidden h-9">
          <div className="relative flex-1 h-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op functietitel..."
              defaultValue={query}
              className="pl-9 h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent rounded-none shadow-none text-sm text-foreground placeholder:text-muted-foreground"
              onChange={(e) => {
                const value = e.target.value;
                clearTimeout(debounceTimers.current.q);
                debounceTimers.current.q = setTimeout(() => {
                  updateParams({ q: value });
                }, 400);
              }}
            />
          </div>
          <Button
            size="icon"
            className="h-full rounded-none px-4 bg-primary hover:bg-primary/90 border-0"
          >
            <Search className="h-4 w-4 text-primary-foreground" />
          </Button>
        </div>

        {/* Dropdowns */}
        <div className="flex w-full lg:w-auto gap-2 items-center shrink-0 overflow-x-auto no-scrollbar">
          <Select
            value={platform || "all"}
            onValueChange={(value) => updateParams({ platform: value === "all" ? "" : value })}
          >
            <SelectTrigger className="w-[150px] h-9 bg-card border-border text-foreground text-sm">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">
                Alle platforms
              </SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize text-foreground">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={endClient || "all"}
            onValueChange={(value) => updateParams({ endClient: value === "all" ? "" : value })}
          >
            <SelectTrigger className="w-[190px] h-9 bg-card border-border text-foreground text-sm">
              <SelectValue placeholder="Eindopdrachtgever" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">
                Alle eindopdrachtgevers
              </SelectItem>
              {endClients.map((client) => (
                <SelectItem key={client} value={client} className="text-foreground">
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={normalizedStatus}
            onValueChange={(value) => updateParams({ status: value === "open" ? "" : value })}
          >
            <SelectTrigger className="w-[140px] h-9 bg-card border-border text-foreground text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="open" className="text-foreground">
                Open
              </SelectItem>
              <SelectItem value="closed" className="text-foreground">
                Gesloten
              </SelectItem>
              <SelectItem value="archived" className="text-foreground">
                Gearchiveerd
              </SelectItem>
              <SelectItem value="all" className="text-foreground">
                Alles
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={provincie || "all"}
            onValueChange={(value) => updateParams({ provincie: value === "all" ? "" : value })}
          >
            <SelectTrigger className="w-[160px] h-9 bg-card border-border text-foreground text-sm">
              <SelectValue placeholder="Provincie" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">
                Alle provincies
              </SelectItem>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p} className="text-foreground">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={contractType || "all"}
            onValueChange={(value) => updateParams({ contractType: value === "all" ? "" : value })}
          >
            <SelectTrigger className="w-[140px] h-9 bg-card border-border text-foreground text-sm">
              <SelectValue placeholder="Contract type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">
                Alle types
              </SelectItem>
              {CONTRACT_TYPES.map((ct) => (
                <SelectItem key={ct.value} value={ct.value} className="text-foreground">
                  {ct.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rate range inputs */}
          <div className="flex items-center gap-1.5 px-2 border-l border-border ml-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">&euro;/uur</span>
            <Input
              type="number"
              placeholder="Min"
              defaultValue={tariefMin}
              className="w-[70px] h-9 bg-card border-border text-foreground text-sm px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onChange={(e) => {
                const value = e.target.value;
                clearTimeout(debounceTimers.current.tariefMin);
                debounceTimers.current.tariefMin = setTimeout(() => {
                  updateParams({ tariefMin: value });
                }, 600);
              }}
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              defaultValue={tariefMax}
              className="w-[70px] h-9 bg-card border-border text-foreground text-sm px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onChange={(e) => {
                const value = e.target.value;
                clearTimeout(debounceTimers.current.tariefMax);
                debounceTimers.current.tariefMax = setTimeout(() => {
                  updateParams({ tariefMax: value });
                }, 600);
              }}
            />
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-2 px-2 border-l border-border ml-1">
            <Switch id="save-search" className="data-[state=checked]:bg-primary" />
            <label
              htmlFor="save-search"
              className="text-sm font-medium text-muted-foreground cursor-pointer whitespace-nowrap"
            >
              Zoekopdracht opslaan
            </label>
          </div>

          <div className="flex items-center gap-2 px-2 border-l border-border ml-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Per pagina</span>
            <Select
              value={String(limit || DEFAULT_OPDRACHTEN_LIMIT)}
              onValueChange={(value) =>
                updateParams({
                  limit: value === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : value,
                  pagina: "1",
                })
              }
            >
              <SelectTrigger className="w-[88px] h-9 bg-card border-border text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)} className="text-foreground">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alle filters button */}
        <Button
          variant="ghost"
          className="h-9 shrink-0 font-medium whitespace-nowrap hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-accent text-sm"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Alle filters
        </Button>
      </div>

      {/* Pagination controls (mobile/bottom) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 border-t border-border pt-3 lg:hidden">
          <p className="text-sm text-muted-foreground">
            Pagina {page} van {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card text-muted-foreground"
              disabled={page <= 1 || isPending}
              onClick={() => updateParams({ pagina: String(page - 1) })}
            >
              Vorige
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card text-muted-foreground"
              disabled={page >= totalPages || isPending}
              onClick={() => updateParams({ pagina: String(page + 1) })}
            >
              Volgende
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
