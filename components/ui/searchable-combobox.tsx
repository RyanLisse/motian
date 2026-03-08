"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SearchableComboboxOption = {
  value: string;
  label: string;
};

type NormalizedSearchableComboboxOption = SearchableComboboxOption & {
  keywords: string[];
};

type SearchableComboboxProps = {
  value?: string;
  options: Array<SearchableComboboxOption | string>;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel?: string;
  buttonClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  triggerId?: string;
};

export function SearchableCombobox({
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  buttonClassName,
  contentClassName,
  itemClassName,
  disabled = false,
  ariaLabel,
  triggerId,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const normalizedValue = value?.trim() ?? "";
  const normalizedOptions = useMemo(() => {
    const seenValues = new Set<string>();

    return options.flatMap<NormalizedSearchableComboboxOption>((option) => {
      const rawOption = typeof option === "string" ? { value: option, label: option } : option;
      const nextValue = rawOption.value.trim();
      const nextLabel = rawOption.label.trim() || nextValue;

      if (!nextValue || seenValues.has(nextValue)) {
        return [];
      }

      seenValues.add(nextValue);

      return [
        {
          value: nextValue,
          label: nextLabel,
          keywords: nextLabel === nextValue ? [nextValue] : [nextValue, nextLabel],
        },
      ];
    });
  }, [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === normalizedValue);
  const selectedLabel = selectedOption?.label ?? normalizedValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", buttonClassName)}
        >
          <span className={cn("truncate", !normalizedValue && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <Command>
          <CommandInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} />
          <CommandList id={listboxId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearLabel ? (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    if (normalizedValue) {
                      onValueChange("");
                    }
                    setOpen(false);
                  }}
                  className={itemClassName}
                >
                  <Check className={cn("size-4", !normalizedValue ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{clearLabel}</span>
                </CommandItem>
              ) : null}
              {normalizedOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  keywords={option.keywords}
                  onSelect={() => {
                    if (normalizedValue !== option.value) {
                      onValueChange(option.value);
                    }
                    setOpen(false);
                  }}
                  className={itemClassName}
                >
                  <Check
                    className={cn(
                      "size-4",
                      normalizedValue === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
