"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StructuredSkill, StructuredSkills } from "@/src/schemas/candidate-intelligence";

interface SkillsTagsProps {
  skills: StructuredSkills;
  sortBy?: "proficiency" | "alphabetical";
  filter?: "all" | "hard" | "soft";
  className?: string;
}

type FilterOption = "all" | "hard" | "soft";
type SortOption = "proficiency" | "alphabetical";

const filterLabels: Record<FilterOption, string> = {
  all: "Alles",
  hard: "Hard",
  soft: "Zacht",
};

const sortLabels: Record<SortOption, string> = {
  proficiency: "Niveau",
  alphabetical: "A-Z",
};

function sortSkills(skills: StructuredSkill[], by: SortOption): StructuredSkill[] {
  return [...skills].sort((a, b) =>
    by === "proficiency" ? b.proficiency - a.proficiency : a.name.localeCompare(b.name),
  );
}

function ProficiencyDots({ level }: { level: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((dot) => (
        <span
          key={`dot-${dot}`}
          className={cn("w-1.5 h-1.5 rounded-full bg-current", dot >= level && "opacity-20")}
        />
      ))}
    </span>
  );
}

function SkillTag({ skill, variant }: { skill: StructuredSkill; variant: "hard" | "soft" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium border",
        variant === "hard"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      )}
    >
      {skill.name}
      <ProficiencyDots level={skill.proficiency} />
    </span>
  );
}

function SegmentedControl<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "px-2.5 py-1 rounded-md transition-colors",
            value === option
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

export function SkillsTags({
  skills,
  sortBy: initialSort = "proficiency",
  filter: initialFilter = "all",
  className,
}: SkillsTagsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>(initialFilter);
  const [activeSort, setActiveSort] = useState<SortOption>(initialSort);

  const sortedHard = sortSkills(skills.hard, activeSort);
  const sortedSoft = sortSkills(skills.soft, activeSort);

  const showHard = activeFilter === "all" || activeFilter === "hard";
  const showSoft = activeFilter === "all" || activeFilter === "soft";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <SegmentedControl
          options={["all", "hard", "soft"] as FilterOption[]}
          labels={filterLabels}
          value={activeFilter}
          onChange={setActiveFilter}
        />
        <SegmentedControl
          options={["proficiency", "alphabetical"] as SortOption[]}
          labels={sortLabels}
          value={activeSort}
          onChange={setActiveSort}
        />
      </div>

      {/* Hard skills */}
      {showHard && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Harde vaardigheden</h3>
          {sortedHard.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortedHard.map((skill) => (
                <SkillTag key={skill.name} skill={skill} variant="hard" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen vaardigheden</p>
          )}
        </section>
      )}

      {/* Divider */}
      {showHard && showSoft && <div className="border-t border-border" />}

      {/* Soft skills */}
      {showSoft && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Zachte vaardigheden</h3>
          {sortedSoft.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortedSoft.map((skill) => (
                <SkillTag key={skill.name} skill={skill} variant="soft" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen vaardigheden</p>
          )}
        </section>
      )}
    </div>
  );
}
