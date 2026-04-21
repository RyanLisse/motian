"use client";

/**
 * Horizontal scrollable filter chips shown on the /vacatures overview page on
 * mobile (< lg). First chip opens the full filter drawer; subsequent chips
 * reflect or toggle individual filters via the same state already owned by
 * useSidebarFilters.
 */
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPES } from "./sidebar-types";

interface MobileFilterChipsProps {
  activeFilterCount: number;
  mobileFiltersOpen: boolean;
  onOpenFilters: () => void;
  rateMin: string;
  rateMax: string;
  hoursMin: string;
  hoursMax: string;
  contractType: string;
  onContractTypeChange: (value: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
}

const THUISWERKEN_TOKEN = "thuiswerken";

export function MobileFilterChips({
  activeFilterCount,
  mobileFiltersOpen,
  onOpenFilters,
  rateMin,
  rateMax,
  hoursMin,
  hoursMax,
  contractType,
  onContractTypeChange,
  inputValue,
  onInputChange,
}: MobileFilterChipsProps) {
  const hasRate = Boolean(rateMin || rateMax);
  const hasHours = Boolean(hoursMin || hoursMax);
  const hasContract = Boolean(contractType);
  const thuiswerkenActive = inputValue.toLowerCase().includes(THUISWERKEN_TOKEN);

  const rateLabel = hasRate ? `€${rateMin || "?"}–${rateMax || "?"}` : "Salaris";
  const hoursLabel = hasHours ? `${hoursMin || "?"}–${hoursMax || "?"} uur` : "Uren";
  const contractLabel = hasContract
    ? (CONTRACT_TYPES.find((c) => c.value === contractType)?.label ?? "Contract")
    : "Contract";

  const toggleThuiswerken = () => {
    if (thuiswerkenActive) {
      const next = inputValue
        .replace(new RegExp(`\\b${THUISWERKEN_TOKEN}\\b`, "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
      onInputChange(next);
    } else {
      const next = inputValue ? `${inputValue.trim()} ${THUISWERKEN_TOKEN}` : THUISWERKEN_TOKEN;
      onInputChange(next);
    }
  };

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-1 lg:hidden">
      <div className="flex min-w-max items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          aria-expanded={mobileFiltersOpen}
          aria-controls="opdrachten-mobile-filters"
          aria-label={mobileFiltersOpen ? "Filters sluiten" : "Filters openen"}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-border bg-background px-3 text-foreground shadow-sm",
            activeFilterCount > 0 && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="ml-1 text-xs font-semibold">{activeFilterCount}</span>
          ) : null}
        </button>

        <ChipButton active={hasRate} onClick={onOpenFilters}>
          {rateLabel}
        </ChipButton>

        <ChipButton active={thuiswerkenActive} onClick={toggleThuiswerken}>
          Thuiswerken
        </ChipButton>

        <Select
          value={contractType || "__all__"}
          onValueChange={(v) => onContractTypeChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Contract type"
            className={cn(
              "h-10 shrink-0 rounded-full border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm data-[size=default]:h-10",
              hasContract && "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            <SelectValue>{contractLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-border bg-card">
            <SelectItem value="__all__">Alle types</SelectItem>
            {CONTRACT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ChipButton active={hasHours} onClick={onOpenFilters}>
          {hoursLabel}
        </ChipButton>
      </div>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-background px-3.5 text-sm font-medium text-foreground shadow-sm",
        active && "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
