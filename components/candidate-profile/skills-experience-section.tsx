"use client";

import { Briefcase, X } from "lucide-react";
import { useState } from "react";
import type { ExperienceEntry } from "@/components/candidate-profile/employment-card";
import { EmploymentCard } from "@/components/candidate-profile/employment-card";
import {
  entryMatchesSkill,
  matchSkillsToExperience,
} from "@/components/candidate-profile/skills-experience-matching";
import { SkillsTags } from "@/components/skills-tags";
import type { StructuredSkills } from "@/src/schemas/candidate-intelligence";

interface SkillsExperienceSectionProps {
  experienceEntries: ExperienceEntry[];
  structuredSkills: StructuredSkills;
  candidateLocation?: string | null;
}

export function SkillsExperienceSection({
  experienceEntries,
  structuredSkills,
  candidateLocation,
}: SkillsExperienceSectionProps) {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const filteredEntries = activeSkill
    ? experienceEntries.filter((entry) => entryMatchesSkill(entry, activeSkill, structuredSkills))
    : experienceEntries;

  const hiddenCount = experienceEntries.length - filteredEntries.length;

  return (
    <div className="space-y-6">
      {/* Skills panel */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Vaardigheden</h2>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SkillsTags
            skills={structuredSkills}
            activeSkill={activeSkill}
            onSkillClick={setActiveSkill}
          />
          {activeSkill && (
            <button
              type="button"
              onClick={() => setActiveSkill(null)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Filter wissen
            </button>
          )}
        </div>
      </section>

      {/* Employment cards with linked skills */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold text-foreground">Werkervaring</h2>
          {activeSkill && (
            <span className="text-xs text-muted-foreground">
              {filteredEntries.length} van {experienceEntries.length} functies
            </span>
          )}
        </div>
        {experienceEntries.length > 0 ? (
          <div className="space-y-3">
            {(activeSkill ? filteredEntries : experienceEntries).map((entry, i) => {
              const linked = matchSkillsToExperience(entry, structuredSkills);
              const highlighted = activeSkill
                ? entryMatchesSkill(entry, activeSkill, structuredSkills)
                : false;

              return (
                <EmploymentCard
                  key={`${entry.company ?? ""}-${entry.title ?? ""}-${i}`}
                  entry={entry}
                  location={entry.location ?? candidateLocation ?? undefined}
                  linkedSkills={linked}
                  activeSkill={activeSkill}
                  isHighlighted={highlighted}
                />
              );
            })}
            {activeSkill && hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                {hiddenCount} {hiddenCount === 1 ? "functie" : "functies"} zonder &ldquo;
                {activeSkill}&rdquo; verborgen
              </p>
            )}
            {activeSkill && filteredEntries.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Geen werkervaring gevonden met &ldquo;{activeSkill}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSkill(null)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Toon alle werkervaring
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Geen werkervaring beschikbaar — upload een CV om ervaring te extraheren
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
