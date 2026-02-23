"use client";

import { Award, ChevronRight, Lightbulb, Sparkles, Star, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { getGradeLabel, ScoreRing } from "@/components/score-ring";
import { KPICard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { GradedCandidate } from "@/src/lib/grading-utils";
import { computeGradeBuckets, extractRadarData } from "@/src/lib/grading-utils";

interface AIGradingProps {
  candidates: GradedCandidate[];
}

export function AIGrading({ candidates }: AIGradingProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = candidates.find((c) => c.matchId === selectedId) ?? null;

  const scores = candidates.map((c) => c.matchScore);
  const buckets = computeGradeBuckets(scores);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">AI Beoordeling</h2>
            <p className="text-sm text-muted-foreground">
              Automatische beoordeling van kandidaten op basis van vacature-eisen
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {candidates.length} beoordeeld
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              Bias-vrij
            </Badge>
          </div>
        </div>
      </div>

      {/* Grade bucket tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={<Star className="h-4 w-4" />}
          label="Uitstekend (90+)"
          value={buckets.excellent}
          iconClassName="text-green-500/60"
          valueClassName="text-green-500"
        />
        <KPICard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Sterk (80-89)"
          value={buckets.strong}
          iconClassName="text-blue-500/60"
          valueClassName="text-blue-500"
        />
        <KPICard
          icon={<Sparkles className="h-4 w-4" />}
          label="Goed (70-79)"
          value={buckets.good}
          iconClassName="text-amber-500/60"
          valueClassName="text-amber-500"
        />
        <KPICard
          icon={<Award className="h-4 w-4" />}
          label="Onder (< 70)"
          value={buckets.below}
          iconClassName="text-red-500/60"
          valueClassName="text-red-500"
        />
      </div>

      {/* Main content: list + optional side panel */}
      <div className="flex gap-6">
        {/* Candidate list */}
        <div className={`flex-1 space-y-3 ${selected ? "max-w-[60%]" : ""}`}>
          {candidates.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Award className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p className="text-sm font-medium text-foreground">Geen beoordelingen gevonden</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start met het matchen van kandidaten aan vacatures
              </p>
            </div>
          ) : (
            candidates.map((c) => {
              const grade = getGradeLabel(c.matchScore);
              const skills = Array.isArray(c.candidateSkills)
                ? (c.candidateSkills as string[]).slice(0, 4)
                : [];
              const breakdown = c.criteriaBreakdown;
              const radarData = extractRadarData(breakdown);

              return (
                <button
                  key={c.matchId}
                  type="button"
                  onClick={() => setSelectedId(c.matchId === selectedId ? null : c.matchId)}
                  className={`w-full text-left bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors ${
                    c.matchId === selectedId ? "border-primary/60 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <ScoreRing score={c.matchScore} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {c.candidateName}
                        </span>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${grade.color}`}>
                          {grade.label}
                        </Badge>
                      </div>
                      {(c.candidateRole || c.jobTitle) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.candidateRole}
                          {c.jobTitle && (
                            <span className="text-muted-foreground/60"> &middot; {c.jobTitle}</span>
                          )}
                        </p>
                      )}

                      {/* Skill tags */}
                      {skills.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mini progress bars */}
                    <div className="shrink-0 w-24 space-y-1.5">
                      {radarData.slice(0, 3).map((d) => (
                        <div key={d.subject}>
                          <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                            <span>{d.subject}</span>
                            <span>{d.value}%</span>
                          </div>
                          <Progress value={d.value} className="h-1" />
                        </div>
                      ))}
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Side panel */}
        {selected && <DetailPanel candidate={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function DetailPanel({ candidate, onClose }: { candidate: GradedCandidate; onClose: () => void }) {
  const radarData = extractRadarData(candidate.criteriaBreakdown);
  const grade = getGradeLabel(candidate.matchScore);
  const skills = Array.isArray(candidate.candidateSkills)
    ? (candidate.candidateSkills as string[])
    : [];
  const suggestions = candidate.enrichmentSuggestions ?? [];

  return (
    <div className="w-[40%] min-w-[320px] bg-card border border-border rounded-xl p-5 space-y-5 sticky top-6 self-start">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">{candidate.candidateName}</h3>
          <p className="text-xs text-muted-foreground">
            {candidate.candidateRole ?? "Geen rol opgegeven"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Score + Grade */}
      <div className="flex items-center gap-4">
        <ScoreRing score={candidate.matchScore} size={72} strokeWidth={5} />
        <div>
          <Badge variant="outline" className={`${grade.color} mb-1`}>
            {grade.label}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Betrouwbaarheid: {candidate.confidence ? `${Math.round(candidate.confidence)}%` : "N/A"}
          </p>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score numbers */}
      <div className="grid grid-cols-3 gap-3">
        {radarData.slice(0, 3).map((d) => (
          <div key={d.subject} className="text-center">
            <p className="text-lg font-bold text-foreground">{d.value}%</p>
            <p className="text-[10px] text-muted-foreground">{d.subject}</p>
          </div>
        ))}
      </div>

      {/* Matched skills */}
      {skills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Vaardigheden</p>
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 8).map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {candidate.reasoning && (
        <div>
          <p className="text-xs font-medium text-foreground mb-1">Samenvatting</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{candidate.reasoning}</p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Suggesties
          </p>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li key={s} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-primary shrink-0">-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
