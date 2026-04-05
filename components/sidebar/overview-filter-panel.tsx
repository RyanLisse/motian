"use client";

/**
 * Full filter panel used on the overview (/vacatures) page.
 */
import { ChevronDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { OPDRACHTEN_PROVINCES } from "@/src/lib/opdrachten-filters";
import {
  CompactMultiSelectFilter,
  FilterChecklist,
  RadiusSliderField,
} from "./sidebar-filter-controls";
import { SidebarSearchBar } from "./sidebar-search-bar";
import type { FilterOption, ProvinceAnchor } from "./sidebar-types";
import { CONTRACT_TYPES } from "./sidebar-types";
import { summarizeHoursRange } from "./sidebar-utils";
import { VacatureFilterExtras } from "./vacature-filter-extras";

interface OverviewFilterPanelProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  isFetching: boolean;
  mobileFiltersOpen: boolean;
  onToggleMobileFilters: () => void;
  activeFilterCount: number;
  displayTotal: number;
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
  rateMinInput: string;
  rateMaxInput: string;
  provinceAnchor: ProvinceAnchor;
  contractType: string;
  onFilterChange: (paramKey: string, value: string) => void;
  onTogglePlatform: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onToggleRegio: (value: string) => void;
  onToggleVakgebied: (value: string) => void;
  onHoursRangeChange: (field: "urenPerWeekMin" | "urenPerWeekMax", value: string) => void;
  onRadiusChange: (value: string) => void;
  onRateMinChange: (value: string) => void;
  onRateMaxChange: (value: string) => void;
  onResetFilters: () => void;
  onlyShortlist: boolean;
  onOnlyShortlistChange: (value: boolean) => void;
}

export function OverviewFilterPanel({
  inputValue,
  onInputChange,
  isFetching,
  mobileFiltersOpen,
  onToggleMobileFilters,
  activeFilterCount,
  displayTotal,
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
  rateMinInput,
  rateMaxInput,
  provinceAnchor,
  contractType,
  onFilterChange,
  onTogglePlatform,
  onProvinceChange,
  onToggleRegio,
  onToggleVakgebied,
  onHoursRangeChange,
  onRadiusChange,
  onRateMinChange,
  onRateMaxChange,
  onResetFilters,
  onlyShortlist,
  onOnlyShortlistChange,
}: OverviewFilterPanelProps) {
  return (
    <div className="flex min-h-0 flex-col border-b border-border/70 px-3 py-2 sm:px-4 sm:py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-xl lg:text-2xl">
          Zoekfilter
        </h3>
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex min-h-9 items-center gap-0.5 rounded-md px-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/5 hover:opacity-80 sm:min-h-11 sm:gap-1 sm:px-2"
        >
          <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Wis filters</span>
          <span className="sm:hidden">Wissen</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
        <SidebarSearchBar
          value={inputValue}
          onChange={onInputChange}
          isFetching={isFetching}
          variant="overview"
        />

        <VacatureFilterExtras
          onlyShortlist={onlyShortlist}
          onOnlyShortlistChange={onOnlyShortlistChange}
        />

        <button
          type="button"
          aria-expanded={mobileFiltersOpen}
          aria-controls="opdrachten-mobile-filters"
          className="inline-flex min-h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-sm sm:min-h-11 sm:px-3 sm:text-sm lg:hidden"
          onClick={onToggleMobileFilters}
        >
          <span className="min-w-0 truncate">
            {mobileFiltersOpen ? "Filters sluiten" : "Filters openen"}
            {activeFilterCount > 0 ? ` (${activeFilterCount} actief)` : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform sm:h-4 sm:w-4",
              mobileFiltersOpen && "rotate-180",
            )}
          />
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:hidden">
          <span>{displayTotal} resultaten</span>
          {activeFilterCount > 0 ? (
            <Badge
              variant="outline"
              className="max-w-full whitespace-normal wrap-break-word border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            >
              {activeFilterCount} filters actief
            </Badge>
          ) : null}
        </div>

        <div
          id="opdrachten-mobile-filters"
          className={cn(
            "min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background/60 p-2.5 sm:space-y-3 sm:p-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:space-y-4",
            !mobileFiltersOpen && "hidden lg:block",
          )}
        >
          <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:gap-0 lg:block">
            <div>
              <label
                htmlFor="opdrachten-opdrachtgever"
                className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
              >
                Platform
              </label>
              <CompactMultiSelectFilter
                label="Alle platforms"
                options={platforms.map((platform) => ({
                  value: platform,
                  label: platform,
                }))}
                selectedValues={selectedPlatforms}
                onToggle={onTogglePlatform}
                buttonClassName="h-10 w-full rounded-lg border-border bg-background text-left text-xs sm:h-11 sm:text-sm"
                contentClassName="bg-card border-border"
              />
            </div>

            <div>
              <label
                htmlFor="opdrachten-eindopdrachtgever"
                className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
              >
                Eindopdrachtgever
              </label>
              <SearchableCombobox
                value={endClient || undefined}
                onValueChange={(value) => onFilterChange("endClient", value)}
                options={endClients}
                placeholder="Alle eindopdrachtgevers"
                searchPlaceholder="Zoek eindopdrachtgever..."
                emptyText="Geen eindopdrachtgevers gevonden."
                clearLabel="Alle eindopdrachtgevers"
                buttonClassName="h-10 rounded-lg border-border bg-background text-left text-xs sm:h-11 sm:text-sm"
                triggerId="opdrachten-eindopdrachtgever"
                ariaLabel="Eindopdrachtgever"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="opdrachten-esco-vaardigheid"
              className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
            >
              Vaardigheid
            </label>
            <SearchableCombobox
              value={vaardigheid || undefined}
              onValueChange={(value) => onFilterChange("vaardigheid", value)}
              options={skillOptions}
              placeholder="Alle vaardigheden"
              searchPlaceholder="Zoek ESCO vaardigheid..."
              emptyText={skillEmptyText}
              clearLabel="Alle vaardigheden"
              buttonClassName="h-10 rounded-lg border-border bg-background text-left text-xs sm:h-11 sm:text-sm"
              triggerId="opdrachten-esco-vaardigheid"
              ariaLabel="ESCO vaardigheid"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-0 lg:block">
            <div>
              <label
                htmlFor="opdrachten-status"
                className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
              >
                Status
              </label>
              <Select
                value={status}
                onValueChange={(v) => onFilterChange("status", v === "open" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-status"
                  className="data-[size=default]:h-10 w-full rounded-lg border-border bg-background text-left text-xs sm:data-[size=default]:h-11 sm:text-sm"
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
                  <SelectItem value="archived" className="text-foreground">
                    Gearchiveerd
                  </SelectItem>
                  <SelectItem value="all" className="text-foreground">
                    Alles
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm">
              Regio
            </p>
            <FilterChecklist
              idPrefix="opdrachten-regio"
              options={regionOptions}
              selectedValues={regios}
              onToggle={onToggleRegio}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:gap-0 lg:block">
            <div>
              <label
                htmlFor="opdrachten-locatie"
                className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
              >
                Provincie
              </label>
              <Select value={provincie || "__all__"} onValueChange={onProvinceChange}>
                <SelectTrigger
                  id="opdrachten-locatie"
                  className="data-[size=default]:h-10 w-full rounded-lg border-border bg-background text-left text-xs sm:data-[size=default]:h-11 sm:text-sm"
                >
                  <SelectValue placeholder="Alle provincies" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle provincies
                  </SelectItem>
                  {OPDRACHTEN_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p} className="text-foreground">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm">
              Vakgebied
            </p>
            <FilterChecklist
              idPrefix="opdrachten-vakgebied"
              options={categoryOptions}
              selectedValues={vakgebieden}
              onToggle={onToggleVakgebied}
              className="max-h-64 overflow-y-auto"
            />
          </div>

          <div>
            <p className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm">
              Uren per week
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Min uren"
                value={hoursMinInput}
                onChange={(e) => onHoursRangeChange("urenPerWeekMin", e.target.value)}
                className="h-10 rounded-lg border-border bg-background text-xs sm:h-11 sm:text-sm"
              />
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Max uren"
                value={hoursMaxInput}
                onChange={(e) => onHoursRangeChange("urenPerWeekMax", e.target.value)}
                className="h-10 rounded-lg border-border bg-background text-xs sm:h-11 sm:text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:mt-2">
              {summarizeHoursRange(hoursMinInput, hoursMaxInput)} — vacatures overlappen met dit
              bereik.
            </p>
          </div>

          <div>
            <p className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm">
              Straal (km)
            </p>
            <RadiusSliderField
              provinceAnchor={provinceAnchor}
              radiusKm={radiusKmInput}
              onRadiusChange={onRadiusChange}
            />
          </div>

          <div>
            <label
              htmlFor="opdrachten-contracttype"
              className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm"
            >
              Contract type
            </label>
            <Select
              value={contractType || "__all__"}
              onValueChange={(v) => onFilterChange("contractType", v === "__all__" ? "" : v)}
            >
              <SelectTrigger
                id="opdrachten-contracttype"
                className="data-[size=default]:h-10 w-full rounded-lg border-border bg-background text-left text-xs sm:data-[size=default]:h-11 sm:text-sm"
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
            <p className="mb-1 block text-xs font-medium text-foreground sm:mb-2 sm:text-sm">
              Tarief per uur
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={rateMinInput}
                onChange={(e) => onRateMinChange(e.target.value)}
                className="h-10 rounded-lg border-border bg-background text-xs sm:h-11 sm:text-sm"
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={rateMaxInput}
                onChange={(e) => onRateMaxChange(e.target.value)}
                className="h-10 rounded-lg border-border bg-background text-xs sm:h-11 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
