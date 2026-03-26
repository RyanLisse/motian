"use client";

/**
 * Reusable filter controls: FilterChecklist, CompactMultiSelectFilter, RadiusSliderField.
 */
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { OPDRACHTEN_RADIUS_OPTIONS } from "@/src/lib/opdrachten-filters";
import type { FilterOption, ProvinceAnchor } from "./sidebar-types";
import { DARK_FILTER_SECTION_LABEL_CLASS } from "./sidebar-types";
import { summarizeSelection } from "./sidebar-utils";

export function FilterChecklist({
  idPrefix,
  options,
  selectedValues,
  onToggle,
  className,
}: {
  idPrefix: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 rounded-lg border border-border bg-background p-2", className)}>
      {options.map((option) => {
        const checked = selectedValues.includes(option.value);
        const checkboxId = `${idPrefix}-${option.value}`;

        return (
          <label
            key={option.value}
            htmlFor={checkboxId}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-accent/50"
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              onCheckedChange={() => onToggle(option.value)}
            />
            <span className="min-w-0 wrap-break-word text-foreground">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function CompactMultiSelectFilter({
  label,
  options,
  selectedValues,
  onToggle,
  buttonClassName,
  contentClassName,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  buttonClassName?: string;
  contentClassName?: string;
}) {
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-7 flex-1 justify-between border-border bg-card px-2 text-[10px] text-foreground",
            buttonClassName,
          )}
        >
          <span className="truncate">{summarizeSelection(label, selectedLabels)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("bg-card border-border", contentClassName)}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RadiusSliderField({
  provinceAnchor,
  radiusKm,
  onRadiusChange,
  compact = false,
}: {
  provinceAnchor: ProvinceAnchor;
  radiusKm: string;
  onRadiusChange: (value: string) => void;
  compact?: boolean;
}) {
  const sliderOptions = [0, ...OPDRACHTEN_RADIUS_OPTIONS];
  const sliderIndex = radiusKm ? Math.max(0, sliderOptions.indexOf(Number(radiusKm))) : 0;

  return (
    <div className={compact ? "px-4 pb-4" : undefined}>
      <div className={cn("mb-2 flex items-center justify-between gap-2", compact && "mb-2")}>
        <span
          className={cn(
            "font-medium text-foreground",
            compact ? DARK_FILTER_SECTION_LABEL_CLASS : "text-sm",
          )}
        >
          Straal
        </span>
        <button
          type="button"
          disabled={!radiusKm}
          onClick={() => onRadiusChange("")}
          className={cn(
            "font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "text-sm text-white/55 hover:text-white" : "text-xs",
          )}
        >
          Reset
        </button>
      </div>

      <div
        className={cn(
          "rounded-lg border border-border bg-background p-3",
          compact &&
            "rounded-[24px] border-white/10 bg-white/[0.035] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn("font-medium", compact ? "text-3xl text-white" : "text-sm")}>
            {radiusKm ? `${radiusKm} km` : "Geen straal"}
          </span>
          <span className={cn(compact ? "text-lg text-white/55" : "text-xs text-muted-foreground")}>
            {provinceAnchor ? provinceAnchor.label : "Eerst provincie"}
          </span>
        </div>
        <Slider
          min={0}
          max={sliderOptions.length - 1}
          step={1}
          value={[sliderIndex]}
          disabled={!provinceAnchor}
          onValueChange={([value]) => {
            const nextRadius = sliderOptions[value] ?? 0;
            onRadiusChange(nextRadius > 0 ? String(nextRadius) : "");
          }}
        />
        <div
          className={cn(
            "mt-2 flex items-center justify-between text-[10px] text-muted-foreground",
            compact && "mt-3 text-sm text-white/55",
          )}
        >
          {sliderOptions.map((value) => (
            <span key={value}>{value === 0 ? "0" : value}</span>
          ))}
        </div>
      </div>

      <p
        className={cn("mt-2 text-muted-foreground", compact ? "text-sm text-white/45" : "text-xs")}
      >
        {provinceAnchor
          ? `Straal wordt toegepast vanaf ${provinceAnchor.label} (${provinceAnchor.province}).`
          : "Kies eerst een provincie om straalfiltering te activeren."}
      </p>
    </div>
  );
}
