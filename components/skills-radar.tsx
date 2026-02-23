"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { StructuredSkills } from "@/src/schemas/candidate-intelligence";

interface SkillsRadarProps {
  skills: StructuredSkills;
  compareWith?: StructuredSkills;
  className?: string;
}

type SkillCategory = "Technisch" | "Domeinkennis" | "Tools" | "Soft Skills" | "Talen";

const TOOL_KEYWORDS = [
  "jira",
  "sap",
  "excel",
  "confluence",
  "figma",
  "docker",
  "kubernetes",
  "git",
  "jenkins",
  "terraform",
  "ansible",
  "tableau",
  "power bi",
  "photoshop",
  "slack",
  "trello",
  "asana",
  "notion",
  "vs code",
  "intellij",
  "postman",
  "aws",
  "azure",
  "gcp",
];
const DOMAIN_KEYWORDS = [
  "finance",
  "healthcare",
  "banking",
  "insurance",
  "logistics",
  "retail",
  "e-commerce",
  "telecom",
  "pharma",
  "automotive",
  "energy",
  "legal",
  "compliance",
  "gdpr",
  "regulatory",
  "accounting",
  "marketing",
  "hr",
  "supply chain",
];
const LANGUAGE_KEYWORDS = [
  "english",
  "dutch",
  "german",
  "french",
  "spanish",
  "mandarin",
  "japanese",
  "arabic",
  "portuguese",
  "italian",
  "russian",
  "hindi",
  "korean",
  "turkish",
  "polish",
  "czech",
  "swedish",
  "norwegian",
  "danish",
  "finnish",
  "nederlands",
  "duits",
  "frans",
  "spaans",
  "engels",
];

function classifyHardSkill(name: string): SkillCategory {
  const lower = name.toLowerCase();
  if (LANGUAGE_KEYWORDS.some((kw) => lower.includes(kw))) return "Talen";
  if (TOOL_KEYWORDS.some((kw) => lower.includes(kw))) return "Tools";
  if (DOMAIN_KEYWORDS.some((kw) => lower.includes(kw))) return "Domeinkennis";
  return "Technisch";
}

interface CategoryData {
  category: SkillCategory;
  value: number;
}

function categorizeSkills(skills: StructuredSkills): CategoryData[] {
  const buckets: Record<SkillCategory, number[]> = {
    Technisch: [],
    Domeinkennis: [],
    Tools: [],
    "Soft Skills": [],
    Talen: [],
  };

  for (const skill of skills.hard) {
    const cat = classifyHardSkill(skill.name);
    buckets[cat].push(skill.proficiency);
  }

  for (const skill of skills.soft) {
    buckets["Soft Skills"].push(skill.proficiency);
  }

  // Only include categories that have skills
  return Object.entries(buckets)
    .filter(([, values]) => values.length > 0)
    .map(([category, values]) => ({
      category: category as SkillCategory,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
}

function FallbackBarChart({
  categories,
  compareCategories,
}: {
  categories: CategoryData[];
  compareCategories?: CategoryData[];
}) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const compareCat = compareCategories?.find((c) => c.category === cat.category);
        return (
          <div key={cat.category}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground">{cat.category}</span>
              <span className="text-muted-foreground">{cat.value.toFixed(1)}/5</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(cat.value / 5) * 100}%` }}
              />
            </div>
            {compareCat && (
              <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(compareCat.value / 5) * 100}%`,
                    backgroundColor: "hsl(280, 68%, 60%)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SkillsRadar({ skills, compareWith, className }: SkillsRadarProps) {
  const categories = categorizeSkills(skills);
  const compareCategories = compareWith ? categorizeSkills(compareWith) : undefined;

  if (categories.length < 3) {
    return (
      <div className={cn("w-full", className)}>
        <FallbackBarChart categories={categories} compareCategories={compareCategories} />
      </div>
    );
  }

  const data = categories.map((cat) => {
    const compareCat = compareCategories?.find((c) => c.category === cat.category);
    return {
      category: cat.category,
      candidate: Math.round(cat.value * 10) / 10,
      ...(compareCat ? { vergelijking: Math.round(compareCat.value * 10) / 10 } : {}),
    };
  });

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(220, 13%, 80%)" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
          <Radar
            name="Kandidaat"
            dataKey="candidate"
            stroke="hsl(221, 83%, 53%)"
            fill="hsl(221, 83%, 53%)"
            fillOpacity={0.2}
          />
          {compareWith && (
            <Radar
              name="Vergelijking"
              dataKey="vergelijking"
              stroke="hsl(280, 68%, 60%)"
              fill="hsl(280, 68%, 60%)"
              fillOpacity={0.1}
            />
          )}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
