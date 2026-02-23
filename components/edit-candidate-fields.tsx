"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "url" | "number" | "select";
  options?: { value: string; label: string }[];
};

const fields: FieldDef[] = [
  { key: "name", label: "Naam", type: "text" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefoon", type: "tel" },
  { key: "role", label: "Functietitel", type: "text" },
  { key: "location", label: "Locatie", type: "text" },
  { key: "hourlyRate", label: "Uurtarief (EUR)", type: "number" },
  {
    key: "availability",
    label: "Beschikbaarheid",
    type: "select",
    options: [
      { value: "direct", label: "Direct beschikbaar" },
      { value: "1_maand", label: "Binnen 1 maand" },
      { value: "3_maanden", label: "Binnen 3 maanden" },
    ],
  },
  { key: "linkedinUrl", label: "LinkedIn URL", type: "url" },
];

type CandidateData = Record<string, string | number | null | undefined>;

export function EditCandidateFields({
  candidateId,
  initialData,
}: {
  candidateId: string;
  initialData: CandidateData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<CandidateData>(initialData);
  const [saving, setSaving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function saveField(key: string, raw: string) {
    const value = key === "hourlyRate" ? (raw ? Number(raw) : null) : raw || null;

    // Skip if unchanged
    if (values[key] === value || (!values[key] && !value)) {
      setEditing(null);
      return;
    }

    setSaving(key);
    try {
      const res = await fetch(`/api/kandidaten/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) {
        setValues((prev) => ({ ...prev, [key]: value }));
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(null);
      setEditing(null);
    }
  }

  function handleSelectChange(key: string, value: string) {
    saveField(key, value);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Profiel</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => {
          const currentValue = values[field.key];
          const displayValue =
            currentValue != null && currentValue !== "" ? String(currentValue) : "";
          const isEditing = editing === field.key;
          const isSaving = saving === field.key;

          return (
            <div key={field.key} className="space-y-1">
              <span className="text-xs text-muted-foreground">{field.label}</span>

              {field.type === "select" ? (
                <Select
                  value={displayValue}
                  onValueChange={(v) => handleSelectChange(field.key, v)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={field.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isEditing ? (
                <Input
                  ref={inputRef}
                  type={field.type}
                  defaultValue={displayValue}
                  className="h-8 text-sm"
                  autoFocus
                  disabled={isSaving}
                  onBlur={(e) => saveField(field.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveField(field.key, e.currentTarget.value);
                    }
                    if (e.key === "Escape") {
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(field.key)}
                  className="w-full text-left h-8 px-3 text-sm rounded-md border border-transparent hover:border-border hover:bg-accent transition-colors truncate"
                >
                  {isSaving ? (
                    <span className="text-muted-foreground">Opslaan…</span>
                  ) : displayValue ? (
                    <span className="text-foreground">{displayValue}</span>
                  ) : (
                    <span className="text-muted-foreground/50">{field.label}</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
