"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
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
  const match = pathname.match(/^\/opdrachten\/(.+)$/);
  const activeId = match?.[1] ?? null;

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [provincie, setProvincie] = useState("");
  const [page, setPage] = useState(1);

  const deferredQuery = useDeferredValue(query);

  // Always fetch from API — enables pagination from the start
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

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <aside className="flex flex-col w-full h-full">
      {/* Search */}
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

      {/* Inline filters */}
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

      {/* Count */}
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

      {/* Job list */}
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

      {/* Pagination */}
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
