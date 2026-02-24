import {
  Briefcase,
  GraduationCap,
  Globe,
  MapPin,
  Star,
  Award,
  BookOpen,
  Calendar,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ParsedCV } from "@/src/schemas/candidate-intelligence";

interface CvProfileCardProps {
  parsed: ParsedCV;
  isExistingCandidate?: boolean;
}

const educationColors: Record<string, string> = {
  PhD: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  WO: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  HBO: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300",
  MBO: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300",
};

function ProficiencyBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 w-3 rounded-full transition-colors ${
            i < level ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function CvProfileCard({ parsed, isExistingCandidate }: CvProfileCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-sm">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{parsed.name}</h3>
          {isExistingCandidate && (
            <Badge variant="outline" className="text-[10px]">Bestaand</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{parsed.role}</p>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
          {parsed.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {parsed.location}
            </span>
          )}
          {parsed.totalYearsExperience != null && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              {parsed.totalYearsExperience} jaar ervaring
            </span>
          )}
          {parsed.highestEducationLevel && (
            <Badge variant="outline" className={`text-[10px] ${educationColors[parsed.highestEducationLevel] ?? ""}`}>
              <GraduationCap className="h-3 w-3 mr-0.5" />
              {parsed.highestEducationLevel}
            </Badge>
          )}
        </div>
      </div>

      {/* Introduction */}
      {parsed.introduction && (
        <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-3">
          {parsed.introduction}
        </p>
      )}

      {/* Skills grid */}
      {(parsed.skills.hard.length > 0 || parsed.skills.soft.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Hard skills */}
          {parsed.skills.hard.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500" />
                Technische vaardigheden
              </p>
              <div className="space-y-1.5">
                {parsed.skills.hard.slice(0, 8).map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate">{skill.name}</span>
                    <ProficiencyBar level={skill.proficiency} />
                  </div>
                ))}
                {parsed.skills.hard.length > 8 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{parsed.skills.hard.length - 8} meer
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Soft skills */}
          {parsed.skills.soft.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-blue-500" />
                Soft skills
              </p>
              <div className="space-y-1.5">
                {parsed.skills.soft.slice(0, 6).map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate">{skill.name}</span>
                    <ProficiencyBar level={skill.proficiency} />
                  </div>
                ))}
                {parsed.skills.soft.length > 6 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{parsed.skills.soft.length - 6} meer
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Experience summary */}
      {parsed.experience.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            Werkervaring
          </p>
          <div className="space-y-1.5">
            {parsed.experience.slice(0, 3).map((exp, i) => (
              <div key={`${exp.company}-${i}`} className="text-xs">
                <span className="font-medium">{exp.title}</span>
                <span className="text-muted-foreground"> — {exp.company}</span>
                <span className="text-muted-foreground/60 ml-1">
                  ({exp.period.start} – {exp.period.end})
                </span>
              </div>
            ))}
            {parsed.experience.length > 3 && (
              <p className="text-[10px] text-muted-foreground">
                +{parsed.experience.length - 3} meer
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom row: languages, certifications, industries */}
      <div className="flex flex-wrap gap-4 pt-1 border-t border-border">
        {/* Languages */}
        {parsed.languages.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Talen
            </p>
            <div className="flex gap-1 flex-wrap">
              {parsed.languages.map((lang) => (
                <Badge key={lang.language} variant="outline" className="text-[10px]">
                  {lang.language} ({lang.level})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {parsed.certifications.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Award className="h-3 w-3" />
              Certificeringen
            </p>
            <div className="flex gap-1 flex-wrap">
              {parsed.certifications.slice(0, 5).map((cert) => (
                <Badge key={cert} variant="outline" className="text-[10px]">
                  {cert}
                </Badge>
              ))}
              {parsed.certifications.length > 5 && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  +{parsed.certifications.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Industries */}
        {parsed.industries.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Sectoren
            </p>
            <div className="flex gap-1 flex-wrap">
              {parsed.industries.map((ind) => (
                <Badge key={ind} variant="secondary" className="text-[10px]">
                  {ind}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
