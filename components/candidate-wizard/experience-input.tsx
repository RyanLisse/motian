"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ExperienceEntry = { title: string; company: string; duration: string };

interface ExperienceInputProps {
  idPrefix?: string;
  value: ExperienceEntry[];
  onChange: (value: ExperienceEntry[]) => void;
}

const emptyEntry: ExperienceEntry = { title: "", company: "", duration: "" };

export function ExperienceInput({ idPrefix, value, onChange }: ExperienceInputProps) {
  const updateAt = useCallback(
    (index: number, field: keyof ExperienceEntry, val: string) => {
      const next = [...value];
      if (!next[index]) next[index] = { ...emptyEntry };
      next[index] = { ...next[index], [field]: val };
      onChange(next);
    },
    [value, onChange],
  );

  const addEntry = useCallback(() => {
    onChange([...value, { ...emptyEntry }]);
  }, [value, onChange]);

  const removeAt = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const pre = idPrefix ?? "exp";
  return (
    <div className="space-y-3">
      {value.map((entry, index) => {
        const titleId = index === 0 ? `${pre}-title` : `${pre}-${index}-title`;
        const companyId = `${pre}-${index}-company`;
        const durationId = `${pre}-${index}-duration`;
        return (
          <div
            key={`${pre}-${index}-${entry.title || entry.company || "e"}`}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end border border-border rounded-lg p-3 bg-muted/20"
          >
            <div className="space-y-1">
              <label htmlFor={titleId} className="text-xs text-muted-foreground">
                Functie
              </label>
              <Input
                id={titleId}
                value={entry.title}
                onChange={(e) => updateAt(index, "title", e.target.value)}
                placeholder="Bijv. Senior Developer"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={companyId} className="text-xs text-muted-foreground">
                Bedrijf
              </label>
              <Input
                id={companyId}
                value={entry.company}
                onChange={(e) => updateAt(index, "company", e.target.value)}
                placeholder="Bedrijfsnaam"
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-1">
              <div className="space-y-1">
                <label htmlFor={durationId} className="text-xs text-muted-foreground">
                  Duur
                </label>
                <Input
                  id={durationId}
                  value={entry.duration}
                  onChange={(e) => updateAt(index, "duration", e.target.value)}
                  placeholder="Bijv. 2 jaar"
                  className="h-8 w-24"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeAt(index)}
                aria-label="Verwijder ervaring"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addEntry} className="gap-2">
        <Plus className="h-4 w-4" />
        Ervaring toevoegen
      </Button>
    </div>
  );
}
