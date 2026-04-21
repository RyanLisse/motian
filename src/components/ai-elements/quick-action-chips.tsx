"use client";

/**
 * Horizontal scrollable recruitment quick-actions shown under the chat composer
 * when no conversation has started yet. Clicking a chip submits a prefilled
 * prompt via the existing suggestion handler.
 */
import { Calendar, FileText, PenSquare, Search, Users } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { Suggestion, Suggestions } from "./suggestion";

type Chip = {
  label: string;
  prompt: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const CHIPS: Chip[] = [
  {
    label: "Schrijf vacaturetekst",
    prompt: "Help me een vacaturetekst schrijven voor een nieuwe rol.",
    icon: PenSquare,
  },
  {
    label: "Zoek vacatures",
    prompt: "Zoek open vacatures die passen bij mijn shortlist.",
    icon: Search,
  },
  {
    label: "Zoek kandidaten",
    prompt: "Toon kandidaten met hun vaardigheden en recente activiteit.",
    icon: Users,
  },
  {
    label: "CV analyseren",
    prompt: "Hoe kan ik een CV uploaden en laten analyseren?",
    icon: FileText,
  },
  {
    label: "Plan interview",
    prompt: "Help me een interviewafspraak in te plannen voor een kandidaat.",
    icon: Calendar,
  },
];

interface QuickActionChipsProps {
  onSelect?: (prompt: string) => void;
}

export function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  if (!onSelect) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-3 sm:px-4 sm:pb-4">
      <Suggestions>
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <Suggestion key={chip.label} suggestion={chip.prompt} onClick={onSelect}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {chip.label}
            </Suggestion>
          );
        })}
      </Suggestions>
    </div>
  );
}
