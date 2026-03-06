"use client";

import { FileText, Info } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StructuredSkill, StructuredSkills } from "@/src/schemas/candidate-intelligence";

const proficiencyLabels: Record<number, string> = {
  1: "Beginner",
  2: "Basis",
  3: "Gevorderd",
  4: "Ervaren",
  5: "Expert",
};

interface SkillsTagsProps {
  skills: StructuredSkills;
  sortBy?: "proficiency" | "alphabetical";
  filter?: "all" | "hard" | "soft";
  className?: string;
  /** Currently selected skill name (for cross-highlighting with employment) */
  activeSkill?: string | null;
  /** Callback when a skill is clicked */
  onSkillClick?: (skillName: string | null) => void;
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

function SkillTag({
  skill,
  variant,
  isActive,
  isDimmed,
  onClick,
}: {
  skill: StructuredSkill;
  variant: "hard" | "soft";
  isActive?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
}) {
  const isInteractive = typeof onClick === "function";
  const sharedClassName = cn(
    "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium border transition-all",
    variant === "hard"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    isActive && "ring-2 ring-primary ring-offset-1 shadow-sm",
    isDimmed && "opacity-40",
    isInteractive && "cursor-pointer",
  );

  const inner = (
    <>
      {skill.name}
      <ProficiencyDots level={skill.proficiency} />
      {skill.evidence && <Info className="ml-1 h-3 w-3 opacity-50" />}
    </>
  );

  const tag = isInteractive ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive ?? false}
      className={sharedClassName}
    >
      {inner}
    </button>
  ) : (
    <span className={sharedClassName}>{inner}</span>
  );

  if (!skill.evidence) return tag;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tag}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">{skill.name}</p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {proficiencyLabels[skill.proficiency] ?? `Niveau ${skill.proficiency}`}
          </span>
        </div>
        <p className="text-xs leading-relaxed">{skill.evidence}</p>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5 border-t border-border/50">
          <FileText className="h-2.5 w-2.5" />
          Bron: CV-analyse
        </p>
      </TooltipContent>
    </Tooltip>
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
  activeSkill,
  onSkillClick,
}: SkillsTagsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>(initialFilter);
  const [activeSort, setActiveSort] = useState<SortOption>(initialSort);

  const sortedHard = sortSkills(skills.hard, activeSort);
  const sortedSoft = sortSkills(skills.soft, activeSort);

  const showHard = activeFilter === "all" || activeFilter === "hard";
  const showSoft = activeFilter === "all" || activeFilter === "soft";

  const hasActiveSkill = activeSkill != null;

  return (
    <TooltipProvider delayDuration={200}>
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

        {/* Interaction hint */}
        {!hasActiveSkill && onSkillClick && (sortedHard.length > 0 || sortedSoft.length > 0) && (
          <p className="text-xs text-muted-foreground/70 italic">
            Klik op een vaardigheid om bijbehorende werkervaring te markeren
          </p>
        )}

        {/* Hard skills */}
        {showHard && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Harde vaardigheden</h3>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {sortedHard.length}
              </span>
            </div>
            {sortedHard.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sortedHard.map((skill) => (
                  <SkillTag
                    key={skill.name}
                    skill={skill}
                    variant="hard"
                    isActive={activeSkill === skill.name}
                    isDimmed={hasActiveSkill && activeSkill !== skill.name}
                    onClick={() => onSkillClick?.(activeSkill === skill.name ? null : skill.name)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Geen harde vaardigheden gevonden in het CV
              </p>
            )}
          </section>
        )}

        {/* Divider */}
        {showHard && showSoft && <div className="border-t border-border" />}

        {/* Soft skills */}
        {showSoft && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Zachte vaardigheden</h3>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {sortedSoft.length}
              </span>
            </div>
            {sortedSoft.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sortedSoft.map((skill) => (
                  <SkillTag
                    key={skill.name}
                    skill={skill}
                    variant="soft"
                    isActive={activeSkill === skill.name}
                    isDimmed={hasActiveSkill && activeSkill !== skill.name}
                    onClick={() => onSkillClick?.(activeSkill === skill.name ? null : skill.name)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Geen zachte vaardigheden gevonden in het CV
              </p>
            )}
          </section>
        )}
      </div>
    </TooltipProvider>
  );
}
