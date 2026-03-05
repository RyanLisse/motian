"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { JobListItem } from "@/components/job-list-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SidebarJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
}

interface SearchResponse {
  jobs: SidebarJob[];
  total: number;
  page: number;
  totalPages: number;
}

interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
  platforms: string[];
}

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

async function searchJobs(
  q: string,
  platform: string,
  provincie: string,
  page: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
  if (provincie) params.set("provincie", provincie);
  if (page > 1) params.set("pagina", String(page));

  const res = await fetch(`/api/opdrachten/zoeken?${params.toString()}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function OpdrachtenSidebar({
  jobs: initialJobs,
  totalCount: initialTotal,
  platforms,
}: OpdrachtenSidebarProps) {
  const pathname = usePathname();
  const isOverviewPage = pathname === "/opdrachten";
  const match = pathname.match(/^\/opdrachten\/(.+)$/);
  const activeId = match?.[1] ?? null;

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [provincie, setProvincie] = useState("");
  const [sortBy, setSortBy] = useState("nieuwst");
  const [page, setPage] = useState(1);

  const deferredQuery = useDeferredValue(query);

  const { data, isFetching } = useQuery({
    queryKey: ["opdrachten-search", deferredQuery, platform, provincie, page],
    queryFn: () => searchJobs(deferredQuery, platform, provincie, page),
    placeholderData: (prev) => prev,
    initialData:
      page === 1 && !deferredQuery && !platform && !provincie
        ? {
            jobs: initialJobs,
            total: initialTotal,
            page: 1,
            totalPages: Math.ceil(initialTotal / 10),
          }
        : undefined,
  });

  const displayJobs = data?.jobs ?? initialJobs;
  const displayTotal = data?.total ?? initialTotal;
  const totalPages = data?.totalPages ?? 1;

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const resetFilters = () => {
    setQuery("");
    setPlatform("");
    setProvincie("");
    setPage(1);
  };

  if (!isOverviewPage) {
    return (
      <aside className="flex h-full w-full flex-col">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek vacatures..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
            />
            {isFetching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <Select
            value={platform || undefined}
            onValueChange={(v) => handleFilterChange(setPlatform, v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Opdrachtgever" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle opdrachtgevers
              </SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize text-foreground text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={provincie || undefined}
            onValueChange={(v) => handleFilterChange(setProvincie, v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Provincie" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle provincies
              </SelectItem>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p} className="text-foreground text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-4 py-2 border-t border-b border-border shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {displayTotal} vacatures
          </p>
          {totalPages > 1 && (
            <p className="text-[10px] text-muted-foreground">
              {page}/{totalPages}
            </p>
          )}
        </div>

        <ScrollArea className="flex-1">
          {displayJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Geen vacatures gevonden
            </div>
          ) : (
            displayJobs.map((job) => (
              <JobListItem key={job.id} job={job} isActive={job.id === activeId} />
            ))
          )}
        </ScrollArea>

        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-border shrink-0 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Vorige
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Volgende
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="h-full w-full bg-sidebar/25">
      <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-border/70 px-4 py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-center rounded-full border-primary/50 bg-background text-primary font-semibold hover:bg-primary/10"
            >
              <Bell className="mr-2 h-4 w-4" />
              Job alert
            </Button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">Zoekfilter</h3>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary hover:opacity-80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Wis filters
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="opdrachten-zoekterm"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Zoekterm
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="opdrachten-zoekterm"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Zoek vacature..."
                  className="h-11 rounded-lg border-border bg-background pl-10 text-sm"
                />
                {isFetching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="opdrachten-opdrachtgever"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Opdrachtgever
              </label>
              <Select
                value={platform || "__all__"}
                onValueChange={(v) => handleFilterChange(setPlatform, v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-opdrachtgever"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle opdrachtgevers" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle opdrachtgevers
                  </SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize text-foreground">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="opdrachten-locatie"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Locatie
              </label>
              <Select
                value={provincie || "__all__"}
                onValueChange={(v) => handleFilterChange(setProvincie, v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-locatie"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle provincies" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle provincies
                  </SelectItem>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p} className="text-foreground">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
            <div className="text-lg font-semibold text-foreground">
              {displayTotal} opdrachten weergegeven
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sorteren:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 w-[210px] rounded-full border-primary/40 bg-background text-sm font-semibold text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="nieuwst">Onlangs toegevoegd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {displayJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                Geen vacatures gevonden voor deze filters.
              </div>
            ) : (
              <div className="space-y-4 pb-4 pr-1">
                {displayJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isActive={job.id === activeId}
                    variant="card"
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border bg-background text-foreground"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Vorige
              </Button>
              <p className="text-sm text-muted-foreground">
                Pagina {page} van {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border bg-background text-foreground"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Volgende
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
