"use client";

import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface SkillsInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  id?: string;
}

export function SkillsInput({
  value,
  onChange,
  placeholder = "Voeg skill toe en druk Enter",
  id,
}: SkillsInputProps) {
  const [input, setInput] = useState("");

  const addSkill = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) {
      setInput("");
      return;
    }
    onChange([...value, trimmed]);
    setInput("");
  }, [input, value, onChange]);

  const removeSkill = useCallback(
    (skill: string) => {
      onChange(value.filter((s) => s !== skill));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 border border-border rounded-lg p-2 bg-background min-h-9">
        {value.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Verwijder ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[120px] h-7 px-1"
        />
      </div>
    </div>
  );
}
