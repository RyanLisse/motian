"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
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
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenStatus,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
} from "@/src/lib/opdrachten-filters";

interface SidebarJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
  pipelineCount?: number;
}

interface SearchResponse {
  jobs: SidebarJob[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
  platforms: string[];
  endClients: string[];
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

const CONTRACT_TYPES = [
  { value: "freelance", label: "Freelance" },
  { value: "interim", label: "Interim" },
  { value: "vast", label: "Vast" },
  { value: "opdracht", label: "Opdracht" },
];

function pushOpdrachtenParams(
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  overrides: Record<string, string>,
) {
  const p = new URLSearchParams(searchParams);
  for (const [k, v] of Object.entries(overrides)) {
    if (k === "pagina") p.delete("page");
    if (k === "limit") p.delete("perPage");

    if (v) {
      p.set(k, v);
    } else {
      p.delete(k);
    }
  }
  const query = p.toString();
  router.push(query ? `/opdrachten?${query}` : "/opdrachten");
}

async function searchJobs(
  q: string,
  platform: string,
  endClient: string,
  status: string,
  provincie: string,
  contractType: string,
  tariefMin: string,
  tariefMax: string,
  page: number,
  limit: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
  if (endClient) params.set("endClient", endClient);
  if (status !== "open") params.set("status", status);
  if (provincie) params.set("provincie", provincie);
  if (contractType) params.set("contractType", contractType);
  if (tariefMin) params.set("tariefMin", tariefMin);
  if (tariefMax) params.set("tariefMax", tariefMax);
  if (page > 1) params.set("pagina", String(page));
  if (limit !== DEFAULT_OPDRACHTEN_LIMIT) params.set("limit", String(limit));

  const res = await fetch(`/api/opdrachten/zoeken?${params.toString()}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function OpdrachtenSidebar({
  jobs: initialJobs,
  totalCount: initialTotal,
  platforms,
  endClients,
}: OpdrachtenSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOverviewPage = pathname === "/opdrachten";
  const match = pathname.match(/^\/opdrachten\/(.+)$/);
  const activeId = match?.[1] ?? null;

  // URL as source of truth for TanStack Query: key and fetch use searchParams so e.g. top-opdrachtgevers link shows correct results immediately
  const q = searchParams.get("q") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const endClient = searchParams.get("endClient") ?? "";
  const status = normalizeOpdrachtenStatus(searchParams.get("status"));
  const provincie = searchParams.get("provincie") ?? "";
  const contractType = searchParams.get("contractType") ?? "";
  const tariefMinParam = searchParams.get("tariefMin") ?? "";
  const tariefMaxParam = searchParams.get("tariefMax") ?? "";
  const pageParam =
    Math.max(
      1,
      Number.parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    ) || 1;
  const limitParam =
    Math.min(
      MAX_OPDRACHTEN_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") ??
            searchParams.get("perPage") ??
            String(DEFAULT_OPDRACHTEN_LIMIT),
          10,
        ),
      ),
    ) || DEFAULT_OPDRACHTEN_LIMIT;

  const [inputValue, setInputValue] = useState(q);
  const [sortBy, setSortBy] = useState("nieuwst");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  // Debounce search input: push to URL after 300ms so queryKey updates (only when user typed, not when we synced from URL)
  useEffect(() => {
    if (inputValue === q) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushOpdrachtenParams(searchParams, router, { q: inputValue, pagina: "1" });
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, q, searchParams, router]);

  const deferredTariefMin = useDeferredValue(tariefMinParam);
  const deferredTariefMax = useDeferredValue(tariefMaxParam);

  const { data, isFetching } = useQuery({
    queryKey: [
      "opdrachten-search",
      q,
      platform,
      endClient,
      status,
      provincie,
      contractType,
      deferredTariefMin,
      deferredTariefMax,
      pageParam,
      limitParam,
    ],
    queryFn: () =>
      searchJobs(
        q,
        platform,
        endClient,
        status,
        provincie,
        contractType,
        deferredTariefMin,
        deferredTariefMax,
        pageParam,
        limitParam,
      ),
    placeholderData: (prev) => prev,
    initialData:
      pageParam === 1 &&
      limitParam === DEFAULT_OPDRACHTEN_LIMIT &&
      !q &&
      !platform &&
      !endClient &&
      status === "open" &&
      !provincie &&
      !contractType &&
      !deferredTariefMin &&
      !deferredTariefMax
        ? {
            jobs: initialJobs,
            total: initialTotal,
            page: 1,
            perPage: DEFAULT_OPDRACHTEN_LIMIT,
            totalPages: Math.ceil(initialTotal / DEFAULT_OPDRACHTEN_LIMIT),
          }
        : undefined,
  });

  const displayJobs = data?.jobs ?? initialJobs;
  const displayTotal = data?.total ?? initialTotal;
  const displayPerPage = data?.perPage ?? limitParam;
  const totalPages = data?.totalPages ?? 1;

  const handleFilterChange = (paramKey: string, value: string) => {
    pushOpdrachtenParams(searchParams, router, { [paramKey]: value, pagina: "1" });
  };

  const resetFilters = () => {
    router.push("/opdrachten");
  };

  if (!isOverviewPage) {
    return (
      <aside className="flex h-full w-full flex-col">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek vacatures..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
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
            onValueChange={(v) => handleFilterChange("platform", v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle platforms
              </SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize text-foreground text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={endClient || undefined}
            onValueChange={(v) => handleFilterChange("endClient", v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Eindopdrachtgever" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle eindopdrachtgevers
              </SelectItem>
              {endClients.map((client) => (
                <SelectItem key={client} value={client} className="text-foreground text-xs">
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <Select
            value={status}
            onValueChange={(v) => handleFilterChange("status", v === "open" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="open" className="text-foreground text-xs">
                Open
              </SelectItem>
              <SelectItem value="closed" className="text-foreground text-xs">
                Gesloten
              </SelectItem>
              <SelectItem value="all" className="text-foreground text-xs">
                Alles
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={provincie || undefined}
            onValueChange={(v) => handleFilterChange("provincie", v === "__all__" ? "" : v)}
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
          <div className="flex items-center gap-2">
            <Select
              value={String(displayPerPage)}
              onValueChange={(v) =>
                pushOpdrachtenParams(searchParams, router, {
                  limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                  pagina: "1",
                })
              }
            >
              <SelectTrigger className="h-7 w-[76px] bg-card border-border text-foreground text-[10px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)} className="text-foreground text-xs">
                    {value} / pg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalPages > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {pageParam}/{totalPages}
              </p>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {displayJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Geen vacatures gevonden
            </div>
          ) : (
            displayJobs.map((job) => (
              <JobListItem
                key={job.id}
                job={job}
                isActive={job.id === activeId}
                pipelineCount={job.pipelineCount}
              />
            ))
          )}
        </ScrollArea>

        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-border shrink-0 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
              disabled={pageParam <= 1 || isFetching}
              onClick={() =>
                pushOpdrachtenParams(searchParams, router, { pagina: String(pageParam - 1) })
              }
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Vorige
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
              disabled={pageParam >= totalPages || isFetching}
              onClick={() =>
                pushOpdrachtenParams(searchParams, router, { pagina: String(pageParam + 1) })
              }
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
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
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
                Platform
              </label>
              <Select
                value={platform || "__all__"}
                onValueChange={(v) => handleFilterChange("platform", v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-opdrachtgever"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle platforms" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle platforms
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
                htmlFor="opdrachten-eindopdrachtgever"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Eindopdrachtgever
              </label>
              <Select
                value={endClient || "__all__"}
                onValueChange={(v) => handleFilterChange("endClient", v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-eindopdrachtgever"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle eindopdrachtgevers" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle eindopdrachtgevers
                  </SelectItem>
                  {endClients.map((client) => (
                    <SelectItem key={client} value={client} className="text-foreground">
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="opdrachten-status"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Status
              </label>
              <Select
                value={status}
                onValueChange={(v) => handleFilterChange("status", v === "open" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-status"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Open" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="open" className="text-foreground">
                    Open
                  </SelectItem>
                  <SelectItem value="closed" className="text-foreground">
                    Gesloten
                  </SelectItem>
                  <SelectItem value="all" className="text-foreground">
                    Alles
                  </SelectItem>
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
                onValueChange={(v) => handleFilterChange("provincie", v === "__all__" ? "" : v)}
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

            <div>
              <label
                htmlFor="opdrachten-contracttype"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Contract type
              </label>
              <Select
                value={contractType || "__all__"}
                onValueChange={(v) => handleFilterChange("contractType", v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-contracttype"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle types" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle types
                  </SelectItem>
                  {CONTRACT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-foreground">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium text-foreground">Tarief per uur</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={tariefMinParam}
                  onChange={(e) =>
                    pushOpdrachtenParams(searchParams, router, {
                      tariefMin: e.target.value,
                      pagina: "1",
                    })
                  }
                  className="h-11 rounded-lg border-border bg-background text-sm"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={tariefMaxParam}
                  onChange={(e) =>
                    pushOpdrachtenParams(searchParams, router, {
                      tariefMax: e.target.value,
                      pagina: "1",
                    })
                  }
                  className="h-11 rounded-lg border-border bg-background text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
            <div className="text-lg font-semibold text-foreground">
              {displayTotal} opdrachten weergegeven
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per pagina:</span>
              <Select
                value={String(displayPerPage)}
                onValueChange={(v) =>
                  pushOpdrachtenParams(searchParams, router, {
                    limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                    pagina: "1",
                  })
                }
              >
                <SelectTrigger className="h-10 w-[110px] rounded-full border-border bg-background text-sm font-semibold text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    pipelineCount={job.pipelineCount}
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
                disabled={pageParam <= 1 || isFetching}
                onClick={() =>
                  pushOpdrachtenParams(searchParams, router, { pagina: String(pageParam - 1) })
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Vorige
              </Button>
              <p className="text-sm text-muted-foreground">
                Pagina {pageParam} van {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border bg-background text-foreground"
                disabled={pageParam >= totalPages || isFetching}
                onClick={() =>
                  pushOpdrachtenParams(searchParams, router, { pagina: String(pageParam + 1) })
                }
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
