"use client";

import { Link2, Save } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOpdrachtenBasePath } from "@/src/lib/opdrachten-filter-url";

const STORAGE_KEY = "motian.vacatureFilterPresets.v1";

type Preset = { id: string; name: string; query: string };

function readPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(presets: Preset[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function VacatureFilterExtras({
  onlyShortlist,
  onOnlyShortlistChange,
}: {
  onlyShortlist: boolean;
  onOnlyShortlistChange: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const shortlistCheckboxId = useId();

  useEffect(() => {
    setPresets(readPresets());
  }, []);

  const shareUrl = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = getOpdrachtenBasePath(pathname);
    const q = searchParams.toString();
    return q ? `${base}${path}?${q}` : `${base}${path}`;
  }, [pathname, searchParams]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback("Link gekopieerd");
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Kopiëren mislukt");
    }
  }, [shareUrl]);

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    const query = searchParams.toString();
    const nextPreset: Preset = {
      id: globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}`,
      name,
      query,
    };
    const list = [...readPresets(), nextPreset];
    writePresets(list);
    setPresets(list);
    setPresetName("");
  }, [presetName, searchParams]);

  const handleLoadPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      const path = getOpdrachtenBasePath(pathname);
      router.push(preset.query ? `${path}?${preset.query}` : path);
    },
    [pathname, presets, router],
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 sm:p-3">
      <label
        htmlFor={shortlistCheckboxId}
        className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
      >
        <Checkbox
          id={shortlistCheckboxId}
          checked={onlyShortlist}
          onCheckedChange={(v) => onOnlyShortlistChange(v === true)}
        />
        <span>Alleen shortlist (actieve sollicitatie, niet afgewezen)</span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Link2 className="mr-1 h-3.5 w-3.5" />
          Deel zoekopdracht
        </Button>
        {copyFeedback ? (
          <span className="text-xs text-muted-foreground">{copyFeedback}</span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Filterset opslaan</span>
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Naam (bijv. Randstad IT)"
            className="h-9"
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleSavePreset}>
          <Save className="mr-1 h-3.5 w-3.5" />
          Opslaan
        </Button>
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Opgeslagen</span>
          <Select onValueChange={handleLoadPreset}>
            <SelectTrigger className="h-9 min-w-48">
              <SelectValue placeholder="Preset laden…" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((pr) => (
                <SelectItem key={pr.id} value={pr.id}>
                  {pr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
