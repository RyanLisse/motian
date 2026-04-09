"use client";

import { BookmarkIcon, Trash2Icon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
/**
 * Compact filter grid used in the detail-page (dark themed) sidebar view.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getOpdrachtenBasePath } from "@/src/lib/opdrachten-filter-url";
import { OPDRACHTEN_PROVINCES } from "@/src/lib/opdrachten-filters";
import { CompactMultiSelectFilter, RadiusSliderField } from "./sidebar-filter-controls";
import { SidebarSortControls } from "./sidebar-sort-controls";
import type { FilterOption, FilterOverrideValue, ProvinceAnchor } from "./sidebar-types";
import {
  DARK_FILTER_CONTROL_CLASS,
  DARK_FILTER_MENU_CLASS,
  DARK_FILTER_PANEL_CLASS,
  DARK_FILTER_SECTION_LABEL_CLASS,
  DARK_FILTER_SECTION_VALUE_CLASS,
  DARK_FILTER_TRIGGER_CLASS,
} from "./sidebar-types";
import { summarizeHoursRange } from "./sidebar-utils";

/* ------------------------------------------------------------------ */
/*  Saved search filter types & hooks                                 */
/* ------------------------------------------------------------------ */

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

type SavedFilterPayload = Record<string, string | string[]>;

/** Fetch, create, and delete saved search filters via /api/zoekfilters. */
function useSavedFilters() {
  const [items, setItems] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFilters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zoekfilters");
      if (res.ok) {
        const json = (await res.json()) as { data: SavedFilter[] };
        setItems(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const createFilter = useCallback(
    async (name: string, filters: SavedFilterPayload) => {
      const res = await fetch("/api/zoekfilters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      if (res.ok) {
        await fetchFilters();
      }
    },
    [fetchFilters],
  );

  const deleteFilter = useCallback(async (id: string) => {
    const res = await fetch(`/api/zoekfilters/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((f) => f.id !== id));
    }
  }, []);

  return { items, loading, createFilter, deleteFilter };
}

interface CompactSidebarFiltersProps {
  selectedPlatforms: string[];
  platforms: string[];
  endClient: string;
  endClients: string[];
  vaardigheid: string;
  skillOptions: FilterOption[];
  skillEmptyText: string;
  status: string;
  provincie: string;
  regios: string[];
  regionOptions: FilterOption[];
  vakgebieden: string[];
  categoryOptions: FilterOption[];
  hoursMinInput: string;
  hoursMaxInput: string;
  radiusKmInput: string;
  provinceAnchor: ProvinceAnchor;
  sort: string;
  sortOptions: readonly { readonly value: string; readonly label: string }[];
  onFilterChange: (paramKey: string, value: FilterOverrideValue) => void;
  onTogglePlatform: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onToggleRegio: (value: string) => void;
  onToggleVakgebied: (value: string) => void;
  onHoursRangeChange: (field: "urenPerWeekMin" | "urenPerWeekMax", value: string) => void;
  onRadiusChange: (value: string) => void;
  onlyShortlist: boolean;
  onOnlyShortlistChange: (value: boolean) => void;
}

export function CompactSidebarFilters({
  selectedPlatforms,
  platforms,
  endClient,
  endClients,
  vaardigheid,
  skillOptions,
  skillEmptyText,
  status,
  provincie,
  regios,
  regionOptions,
  vakgebieden,
  categoryOptions,
  hoursMinInput,
  hoursMaxInput,
  radiusKmInput,
  provinceAnchor,
  sort,
  sortOptions,
  onFilterChange,
  onTogglePlatform,
  onProvinceChange,
  onToggleRegio,
  onToggleVakgebied,
  onHoursRangeChange,
  onRadiusChange,
  onlyShortlist,
  onOnlyShortlistChange,
}: CompactSidebarFiltersProps) {
  const shortlistCheckboxId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items: savedFilters, createFilter, deleteFilter } = useSavedFilters();
  const [saveOpen, setSaveOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const handleSaveFilter = useCallback(async () => {
    const name = filterName.trim();
    if (!name) return;
    const filters: SavedFilterPayload = {};
    for (const [key, value] of searchParams.entries()) {
      const existing = filters[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (typeof existing === "string") {
        filters[key] = [existing, value];
      } else {
        filters[key] = value;
      }
    }
    await createFilter(name, filters);
    setFilterName("");
    setSaveOpen(false);
  }, [filterName, searchParams, createFilter]);

  const handleApplyFilter = useCallback(
    (filters: Record<string, unknown>) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === "string" && item.trim()) params.append(key, item);
          });
          continue;
        }
        if (typeof value === "string" && value) {
          params.set(key, value);
        }
      }
      const query = params.toString();
      const basePath = getOpdrachtenBasePath(pathname);
      router.push(query ? `${basePath}?${query}` : basePath);
    },
    [pathname, router],
  );

  return (
    <>
      <div className="mx-3 mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
            >
              Opgeslagen filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={cn("w-64", DARK_FILTER_MENU_CLASS)} align="start">
            <DropdownMenuLabel className="text-white">Opgeslagen filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {savedFilters.length === 0 ? (
                <DropdownMenuItem disabled className="text-white/50">
                  Geen opgeslagen filters
                </DropdownMenuItem>
              ) : (
                savedFilters.map((savedFilter) => (
                  <DropdownMenuItem
                    key={savedFilter.id}
                    onSelect={(event) => event.preventDefault()}
                    className="flex items-center justify-between gap-2 text-white"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => handleApplyFilter(savedFilter.filters)}
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                      onClick={() => deleteFilter(savedFilter.id)}
                      aria-label={`Verwijder filter ${savedFilter.name}`}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Verwijderen
                    </button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <label
        htmlFor={shortlistCheckboxId}
        className="mx-3 mb-1 flex cursor-pointer items-center gap-2 text-xs text-white/80"
      >
        <Checkbox
          id={shortlistCheckboxId}
          checked={onlyShortlist}
          onCheckedChange={(v) => onOnlyShortlistChange(v === true)}
          className="border-white/30 data-[state=checked]:bg-primary"
        />
        <span>Alleen shortlist</span>
      </label>
      <div className="grid shrink-0 gap-2 px-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CompactMultiSelectFilter
            label="Platform"
            options={platforms.map((platform) => ({
              value: platform,
              label: platform,
            }))}
            selectedValues={selectedPlatforms}
            onToggle={onTogglePlatform}
            buttonClassName={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
            contentClassName={DARK_FILTER_MENU_CLASS}
          />

          <SearchableCombobox
            value={endClient || undefined}
            onValueChange={(value) => onFilterChange("endClient", value)}
            options={endClients}
            placeholder="Eindopdrachtgever"
            searchPlaceholder="Zoek eindopdrachtgever..."
            emptyText="Geen eindopdrachtgevers gevonden."
            clearLabel="Alle eindopdrachtgevers"
            buttonClassName={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
            contentClassName={DARK_FILTER_MENU_CLASS}
            itemClassName="text-sm text-white"
          />
        </div>

        <SearchableCombobox
          value={vaardigheid || undefined}
          onValueChange={(value) => onFilterChange("vaardigheid", value)}
          options={skillOptions}
          placeholder="Vaardigheid"
          searchPlaceholder="Zoek ESCO vaardigheid..."
          emptyText={skillEmptyText}
          clearLabel="Alle vaardigheden"
          buttonClassName={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
          contentClassName={DARK_FILTER_MENU_CLASS}
          itemClassName="text-sm text-white"
          triggerId="opdrachten-esco-vaardigheid"
          ariaLabel="ESCO vaardigheid"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            value={status}
            onValueChange={(v) => onFilterChange("status", v === "open" ? "" : v)}
          >
            <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className={DARK_FILTER_MENU_CLASS}>
              <SelectItem value="open" className="text-white">
                Open
              </SelectItem>
              <SelectItem value="closed" className="text-white">
                Gesloten
              </SelectItem>
              <SelectItem value="archived" className="text-white">
                Gearchiveerd
              </SelectItem>
              <SelectItem value="all" className="text-white">
                Alles
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={provincie || undefined} onValueChange={onProvinceChange}>
            <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
              <SelectValue placeholder="Provincie" />
            </SelectTrigger>
            <SelectContent className={DARK_FILTER_MENU_CLASS}>
              <SelectItem value="__all__" className="text-white">
                Alle provincies
              </SelectItem>
              {OPDRACHTEN_PROVINCES.map((p) => (
                <SelectItem key={p} value={p} className="text-white">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CompactMultiSelectFilter
            label="Regio"
            options={regionOptions}
            selectedValues={regios}
            onToggle={onToggleRegio}
            buttonClassName={cn(
              "h-12 rounded-[20px] px-4 text-[15px] text-white",
              DARK_FILTER_PANEL_CLASS,
            )}
            contentClassName={DARK_FILTER_MENU_CLASS}
          />
          <CompactMultiSelectFilter
            label="Vakgebied"
            options={categoryOptions}
            selectedValues={vakgebieden}
            onToggle={onToggleVakgebied}
            buttonClassName={cn(
              "h-12 rounded-[20px] px-4 text-[15px] text-white",
              DARK_FILTER_PANEL_CLASS,
            )}
            contentClassName={DARK_FILTER_MENU_CLASS}
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className={DARK_FILTER_SECTION_LABEL_CLASS}>Uren per week</span>
            <span className={DARK_FILTER_SECTION_VALUE_CLASS}>
              {summarizeHoursRange(hoursMinInput, hoursMaxInput)}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Min"
              value={hoursMinInput}
              onChange={(e) => onHoursRangeChange("urenPerWeekMin", e.target.value)}
              className={DARK_FILTER_CONTROL_CLASS}
            />
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Max"
              value={hoursMaxInput}
              onChange={(e) => onHoursRangeChange("urenPerWeekMax", e.target.value)}
              className={DARK_FILTER_CONTROL_CLASS}
            />
          </div>
        </div>
      </div>

      <RadiusSliderField
        provinceAnchor={provinceAnchor}
        radiusKm={radiusKmInput}
        onRadiusChange={onRadiusChange}
        compact
      />

      <SidebarSortControls
        sort={sort}
        sortOptions={sortOptions}
        onSortChange={(value) => onFilterChange("sort", value)}
        variant="compact"
      />

      <div className="mx-3 mt-2">
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <BookmarkIcon data-icon="inline-start" />
              Zoekfilter opslaan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zoekfilter opslaan</DialogTitle>
            </DialogHeader>
            <label htmlFor="compact-saved-filter-name" className="text-sm font-medium">
              Naam
            </label>
            <Input
              id="compact-saved-filter-name"
              placeholder="Naam van het filter"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveFilter();
              }}
            />
            <DialogFooter>
              <Button type="button" disabled={!filterName.trim()} onClick={handleSaveFilter}>
                Opslaan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
