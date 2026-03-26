"use client";

/**
 * Compact filter grid used in the detail-page (dark themed) sidebar view.
 */
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
import { CompactMultiSelectFilter, RadiusSliderField } from "./sidebar-filter-controls";
import { SidebarSortControls } from "./sidebar-sort-controls";
import type { FilterOption, ProvinceAnchor } from "./sidebar-types";
import {
  DARK_FILTER_CONTROL_CLASS,
  DARK_FILTER_MENU_CLASS,
  DARK_FILTER_PANEL_CLASS,
  DARK_FILTER_SECTION_LABEL_CLASS,
  DARK_FILTER_SECTION_VALUE_CLASS,
  DARK_FILTER_TRIGGER_CLASS,
} from "./sidebar-types";
import { summarizeHoursRange } from "./sidebar-utils";

interface CompactSidebarFiltersProps {
  platform: string;
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
  onFilterChange: (paramKey: string, value: string) => void;
  onProvinceChange: (value: string) => void;
  onToggleRegio: (value: string) => void;
  onToggleVakgebied: (value: string) => void;
  onHoursRangeChange: (field: "urenPerWeekMin" | "urenPerWeekMax", value: string) => void;
  onRadiusChange: (value: string) => void;
}

export function CompactSidebarFilters({
  platform,
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
  onProvinceChange,
  onToggleRegio,
  onToggleVakgebied,
  onHoursRangeChange,
  onRadiusChange,
}: CompactSidebarFiltersProps) {
  return (
    <>
      <div className="grid shrink-0 gap-3 px-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={platform || undefined}
            onValueChange={(v) => onFilterChange("platform", v === "__all__" ? "" : v)}
          >
            <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent className={DARK_FILTER_MENU_CLASS}>
              <SelectItem value="__all__" className="text-white">
                Alle platforms
              </SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize text-white">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

        <div className="grid grid-cols-2 gap-3">
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

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className={DARK_FILTER_SECTION_LABEL_CLASS}>Uren per week</span>
            <span className={DARK_FILTER_SECTION_VALUE_CLASS}>
              {summarizeHoursRange(hoursMinInput, hoursMaxInput)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
    </>
  );
}
