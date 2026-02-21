"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Brain,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  Shield,
  Lightbulb,
  Zap,
  ArrowDown,
  Target,
  BarChart3,
  Layers,
  GitBranch,
  Sparkles,
  TrendingUp,
  Eye,
} from "lucide-react"
import { candidates, positionsList, type Candidate } from "@/lib/data"
import type { Job } from "@/lib/data"

// ---------------------------------------------------------------------------
// Matching Engine (same logic as /matching page, exported for transparency)
// ---------------------------------------------------------------------------

function parseYears(exp: string): number {
  const m = exp.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

interface KnockOutResult {
  criterion: string
  required: boolean
  met: boolean
  evidence: string
}

interface ScoringResult {
  criterion: string
  weight: number
  score: number // 1-5
  explanation: string
  rawValue: number // the underlying percentage
}

interface MatchAnalysis {
  candidate: Candidate
  job: Job
  overallScore: number
  knockOuts: KnockOutResult[]
  allKnockOutsMet: boolean
  scoring: ScoringResult[]
  weightedTotal: number
  riskLevel: "Laag" | "Gemiddeld" | "Hoog"
  riskExplanation: string
  recommendations: string[]
  matchedSkills: string[]
  missingSkills: string[]
}

function runFullAnalysis(candidate: Candidate, job: Job): MatchAnalysis {
  const matchedSkills = job.requiredSkills.filter((s) =>
    candidate.skills.some((cs) => cs.toLowerCase() === s.toLowerCase())
  )
  const missingSkills = job.requiredSkills.filter(
    (s) => !candidate.skills.some((cs) => cs.toLowerCase() === s.toLowerCase())
  )
  const years = parseYears(candidate.experience)

  // Knock-out criteria
  const knockOuts: KnockOutResult[] = [
    {
      criterion: "Minimaal 3 jaar ervaring",
      required: true,
      met: years >= 3,
      evidence: `${years} jaar werkervaring`,
    },
    ...job.requiredSkills.map((skill) => {
      const has = candidate.skills.some(
        (cs) => cs.toLowerCase() === skill.toLowerCase()
      )
      return {
        criterion: `Vaardigheid: ${skill}`,
        required: true,
        met: has,
        evidence: has
          ? `${skill} bevestigd in profiel`
          : `${skill} niet gevonden`,
      }
    }),
    {
      criterion: "Locatie compatibiliteit",
      required: false,
      met: candidate.location === job.location,
      evidence:
        candidate.location === job.location
          ? `Beide in ${candidate.location}`
          : `Kandidaat: ${candidate.location}, Opdracht: ${job.location}`,
    },
  ]

  const allKnockOutsMet = knockOuts.filter((k) => k.required).every((k) => k.met)

  // Scoring
  const skillMatchRaw = candidate.skillMatch
  const experienceRaw = Math.min(100, years * 12.5)
  const problemRaw = Math.round(
    (candidate.skillMatch + candidate.relevance) / 2
  )
  const commRaw = Math.round(
    (candidate.resumeQuality + candidate.relevance) / 2
  )
  const cultureRaw = Math.round(
    (candidate.relevance + candidate.resumeQuality + candidate.skillMatch) / 3
  )

  const toStars = (v: number) => Math.min(5, Math.max(1, Math.round((v / 100) * 5)))

  const scoring: ScoringResult[] = [
    {
      criterion: "Technische Skills",
      weight: 30,
      score: toStars(skillMatchRaw),
      rawValue: skillMatchRaw,
      explanation: `${matchedSkills.length}/${job.requiredSkills.length} vereiste skills`,
    },
    {
      criterion: "Ervaring",
      weight: 25,
      score: toStars(experienceRaw),
      rawValue: experienceRaw,
      explanation: `${years} jaar relevante werkervaring`,
    },
    {
      criterion: "Probleemoplossend",
      weight: 20,
      score: toStars(problemRaw),
      rawValue: problemRaw,
      explanation:
        problemRaw >= 80
          ? "Sterk analytisch denkvermogen"
          : "Gemiddeld analytisch niveau",
    },
    {
      criterion: "Communicatie",
      weight: 15,
      score: toStars(commRaw),
      rawValue: commRaw,
      explanation:
        commRaw >= 80
          ? "Uitstekende communicatieve vaardigheden"
          : "Voldoende communicatie",
    },
    {
      criterion: "Culturele Fit",
      weight: 10,
      score: toStars(cultureRaw),
      rawValue: cultureRaw,
      explanation:
        cultureRaw >= 80
          ? "Sterke aansluiting"
          : "Redelijke aansluiting",
    },
  ]

  const weightedTotal = Math.round(
    scoring.reduce((sum, r) => sum + (r.score / 5) * r.weight, 0)
  )

  let riskLevel: "Laag" | "Gemiddeld" | "Hoog"
  let riskExplanation: string
  if (!allKnockOutsMet) {
    riskLevel = "Hoog"
    riskExplanation =
      "Knock-out criteria niet voldaan. Aanvullende evaluatie nodig."
  } else if (weightedTotal >= 80) {
    riskLevel = "Laag"
    riskExplanation = "Uitstekende match op alle dimensies."
  } else if (weightedTotal >= 65) {
    riskLevel = "Gemiddeld"
    riskExplanation = "Voldoet aan basis maar heeft ontwikkelpunten."
  } else {
    riskLevel = "Hoog"
    riskExplanation = "Meerdere gaps geidentificeerd."
  }

  let recommendations: string[]
  if (weightedTotal >= 80 && allKnockOutsMet) {
    recommendations = [
      "Direct uitnodigen voor verdiepend interview.",
      "Referenties opvragen ter validatie.",
      "Aanbod voorbereiden — kandidaat is gewild.",
    ]
  } else if (weightedTotal >= 65) {
    recommendations = [
      "Screening inplannen voor motivatiegesprek.",
      "Skill assessment voor ontbrekende vaardigheden.",
      "Portfolio of referenties verificeren.",
    ]
  } else {
    recommendations = [
      "Overweeg alternatieve opdracht.",
      "Bijscholingstraject bespreken.",
      "Andere kandidaten prioriteren.",
    ]
  }

  return {
    candidate,
    job,
    overallScore: weightedTotal,
    knockOuts,
    allKnockOutsMet,
    scoring,
    weightedTotal,
    riskLevel,
    riskExplanation,
    recommendations,
    matchedSkills,
    missingSkills,
  }
}

// ---------------------------------------------------------------------------
// Animated step component
// ---------------------------------------------------------------------------

function StepCard({
  step,
  title,
  description,
  icon: Icon,
  color,
  children,
  active,
}: {
  step: number
  title: string
  description: string
  icon: React.ElementType
  color: string
  children: React.ReactNode
  active: boolean
}) {
  return (
    <div
      className={`transition-all duration-500 ${
        active
          ? "opacity-100 translate-y-0"
          : "opacity-30 translate-y-2 pointer-events-none"
      }`}
    >
      <Card className="bg-[#1e1e1e] border-[#2d2d2d] overflow-hidden">
        {/* Step header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2d2d2d]">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: color }}
          >
            {step}
          </div>
          <div
            className="flex items-center justify-center h-8 w-8 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#ececec]">{title}</p>
            <p className="text-xs text-[#6b6b6b]">{description}</p>
          </div>
        </div>
        {/* Step content */}
        <div className="p-5">{children}</div>
      </Card>
    </div>
  )
}

function ArrowConnector({ active }: { active: boolean }) {
  return (
    <div
      className={`flex justify-center py-2 transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-20"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-[#2d2d2d]" />
        <ArrowDown className="h-4 w-4 text-[#10a37f]" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stars helper
// ---------------------------------------------------------------------------

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < count
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-[#2d2d2d]"
          }`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function VisualExplainerPage() {
  const [selectedCandidateId, setSelectedCandidateId] = useState("")
  const [selectedJobId, setSelectedJobId] = useState("")
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null)
  const [currentStep, setCurrentStep] = useState(0) // 0 = not started, 1-6 = steps
  const [isAnimating, setIsAnimating] = useState(false)

  const candidate = candidates.find((c) => c.id === selectedCandidateId)
  const job = positionsList.find((j) => j.id === selectedJobId)

  function startAnalysis() {
    if (!candidate || !job) return
    const result = runFullAnalysis(candidate, job)
    setAnalysis(result)
    setIsAnimating(true)
    setCurrentStep(0)

    // Animate through steps
    const steps = [1, 2, 3, 4, 5, 6]
    steps.forEach((step, i) => {
      setTimeout(() => {
        setCurrentStep(step)
        if (i === steps.length - 1) {
          setIsAnimating(false)
        }
      }, (i + 1) * 800)
    })
  }

  function resetAnalysis() {
    setAnalysis(null)
    setCurrentStep(0)
    setIsAnimating(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10a37f]/10">
              <Eye className="h-7 w-7 text-[#10a37f]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#ececec]">
            Hoe Werkt AI Matching?
          </h1>
          <p className="text-sm text-[#6b6b6b] max-w-lg mx-auto">
            Kies een kandidaat en opdracht om stap voor stap te zien hoe het
            matching algoritme een beslissing neemt. Elke stap wordt visueel
            uitgelegd.
          </p>
        </div>

        {/* Selection */}
        <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-5">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-5 w-5 text-[#10a37f]" />
            <p className="text-sm font-semibold text-[#ececec]">
              Selecteer input
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8e8e8e] mb-1.5 block">
                Kandidaat
              </label>
              <Select
                value={selectedCandidateId}
                onValueChange={(v) => {
                  setSelectedCandidateId(v)
                  resetAnalysis()
                }}
              >
                <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                  <SelectValue placeholder="Kies kandidaat..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                  {candidates.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                    >
                      {c.name} — {c.role} ({c.score})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#8e8e8e] mb-1.5 block">
                Opdracht
              </label>
              <Select
                value={selectedJobId}
                onValueChange={(v) => {
                  setSelectedJobId(v)
                  resetAnalysis()
                }}
              >
                <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                  <SelectValue placeholder="Kies opdracht..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                  {positionsList.map((j) => (
                    <SelectItem
                      key={j.id}
                      value={j.id}
                      className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                    >
                      {j.title} — {j.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {candidate && job && !analysis && (
            <Button
              className="w-full mt-4 bg-[#10a37f] text-white hover:bg-[#0e8c6b] gap-2"
              onClick={startAnalysis}
            >
              <Brain className="h-4 w-4" />
              Start Visuele Analyse
            </Button>
          )}

          {analysis && (
            <Button
              variant="outline"
              className="w-full mt-4 border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d]"
              onClick={resetAnalysis}
              disabled={isAnimating}
            >
              Reset &amp; Opnieuw
            </Button>
          )}
        </Card>

        {/* Candidate & Job preview cards */}
        {candidate && job && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
              <p className="text-[10px] uppercase text-[#6b6b6b] tracking-wider mb-2">
                Kandidaat
              </p>
              <p className="text-sm font-semibold text-[#ececec]">
                {candidate.name}
              </p>
              <p className="text-xs text-[#8e8e8e]">
                {candidate.role} &middot; {candidate.experience}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {candidate.skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 text-[10px] rounded bg-[#10a37f]/10 text-[#10a37f]"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#141414] rounded px-2 py-1.5">
                  <p className="text-xs font-bold text-[#22c55e]">
                    {candidate.skillMatch}%
                  </p>
                  <p className="text-[9px] text-[#6b6b6b]">Skill</p>
                </div>
                <div className="bg-[#141414] rounded px-2 py-1.5">
                  <p className="text-xs font-bold text-[#3b82f6]">
                    {candidate.relevance}%
                  </p>
                  <p className="text-[9px] text-[#6b6b6b]">Relevantie</p>
                </div>
                <div className="bg-[#141414] rounded px-2 py-1.5">
                  <p className="text-xs font-bold text-[#f59e0b]">
                    {candidate.resumeQuality}%
                  </p>
                  <p className="text-[9px] text-[#6b6b6b]">CV</p>
                </div>
              </div>
            </Card>
            <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
              <p className="text-[10px] uppercase text-[#6b6b6b] tracking-wider mb-2">
                Opdracht
              </p>
              <p className="text-sm font-semibold text-[#ececec]">
                {job.title}
              </p>
              <p className="text-xs text-[#8e8e8e]">
                {job.department} &middot; {job.location} &middot; {job.type}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {job.requiredSkills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#8e8e8e]">
                <span>{job.applicants} sollicitanten</span>
                <Badge
                  variant="outline"
                  className="border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/10 text-[10px]"
                >
                  {job.status}
                </Badge>
              </div>
            </Card>
          </div>
        )}

        {/* Analysis Steps */}
        {analysis && (
          <div className="space-y-1">
            {/* Step 1: Data Intake */}
            <StepCard
              step={1}
              title="Data Intake"
              description="Kandidaat profiel en opdracht vereisten laden"
              icon={Layers}
              color="#3b82f6"
              active={currentStep >= 1}
            >
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[#8e8e8e] mb-2">Kandidaat data:</p>
                  <div className="space-y-1.5 text-[#ececec]">
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Naam</span>
                      <span>{analysis.candidate.name}</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Ervaring</span>
                      <span>{analysis.candidate.experience}</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Skills</span>
                      <span>{analysis.candidate.skills.length} vaardigheden</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">AI Score</span>
                      <span className="font-semibold text-[#10a37f]">{analysis.candidate.score}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[#8e8e8e] mb-2">Opdracht vereisten:</p>
                  <div className="space-y-1.5 text-[#ececec]">
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Functie</span>
                      <span className="truncate ml-2">{analysis.job.title}</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Locatie</span>
                      <span>{analysis.job.location}</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Vereiste skills</span>
                      <span>{analysis.job.requiredSkills.length} stuks</span>
                    </div>
                    <div className="flex justify-between bg-[#141414] rounded px-3 py-1.5">
                      <span className="text-[#8e8e8e]">Afdeling</span>
                      <span>{analysis.job.department}</span>
                    </div>
                  </div>
                </div>
              </div>
            </StepCard>

            <ArrowConnector active={currentStep >= 2} />

            {/* Step 2: Skill Matching */}
            <StepCard
              step={2}
              title="Skill Matching"
              description="Vergelijk kandidaat skills met opdracht vereisten"
              icon={Target}
              color="#10a37f"
              active={currentStep >= 2}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-[#22c55e] tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Match ({analysis.matchedSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.matchedSkills.length > 0 ? (
                        analysis.matchedSkills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-1 text-[10px] rounded bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#6b6b6b]">Geen matches</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-red-400 tracking-wider mb-2 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Ontbreekt ({analysis.missingSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.missingSkills.length > 0 ? (
                        analysis.missingSkills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-1 text-[10px] rounded bg-red-500/15 text-red-400 border border-red-500/20"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#22c55e]">Alle skills aanwezig!</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Visual match ratio */}
                <div className="bg-[#141414] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#8e8e8e]">Skill match ratio</span>
                    <span className="text-xs font-bold text-[#ececec]">
                      {analysis.matchedSkills.length}/{analysis.job.requiredSkills.length}
                    </span>
                  </div>
                  <div className="h-3 bg-[#2d2d2d] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#22c55e] transition-all duration-700 rounded-l-full"
                      style={{
                        width: `${(analysis.matchedSkills.length / Math.max(1, analysis.job.requiredSkills.length)) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-red-500/40 transition-all duration-700"
                      style={{
                        width: `${(analysis.missingSkills.length / Math.max(1, analysis.job.requiredSkills.length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </StepCard>

            <ArrowConnector active={currentStep >= 3} />

            {/* Step 3: Knock-Out Check */}
            <StepCard
              step={3}
              title="Knock-Out Check"
              description="Harde vereisten die moeten worden voldaan"
              icon={Shield}
              color="#ef4444"
              active={currentStep >= 3}
            >
              <div className="space-y-2">
                {analysis.knockOuts.map((ko) => (
                  <div
                    key={ko.criterion}
                    className={`flex items-center gap-3 bg-[#141414] rounded-lg px-4 py-2.5 border ${
                      ko.met
                        ? "border-[#22c55e]/20"
                        : "border-red-500/20"
                    }`}
                  >
                    {ko.met ? (
                      <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#ececec]">
                        {ko.criterion}
                      </p>
                      <p className="text-[10px] text-[#6b6b6b]">
                        {ko.evidence}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        ko.required
                          ? "border-red-500/30 text-red-400"
                          : "border-[#2d2d2d] text-[#6b6b6b]"
                      }`}
                    >
                      {ko.required ? "Vereist" : "Optioneel"}
                    </Badge>
                  </div>
                ))}
                <div
                  className={`mt-3 p-3 rounded-lg text-center text-xs font-medium ${
                    analysis.allKnockOutsMet
                      ? "bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {analysis.allKnockOutsMet
                    ? "Alle knock-out criteria voldaan — doorgaan naar scoring"
                    : "Knock-out criteria NIET voldaan — hoog risico"}
                </div>
              </div>
            </StepCard>

            <ArrowConnector active={currentStep >= 4} />

            {/* Step 4: Weighted Scoring */}
            <StepCard
              step={4}
              title="Gewogen Score Berekening"
              description="5 dimensies met gewichten voor totaalscore"
              icon={BarChart3}
              color="#f59e0b"
              active={currentStep >= 4}
            >
              <div className="space-y-3">
                {analysis.scoring.map((row) => (
                  <div key={row.criterion} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#ececec]">
                          {row.criterion}
                        </span>
                        <span className="text-[10px] text-[#6b6b6b]">
                          ({row.weight}% gewicht)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Stars count={row.score} />
                        <span className="text-[10px] text-[#8e8e8e] w-8 text-right">
                          {row.rawValue}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#2d2d2d] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${row.rawValue}%`,
                          backgroundColor:
                            row.rawValue >= 80
                              ? "#22c55e"
                              : row.rawValue >= 60
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#6b6b6b]">
                      {row.explanation}
                    </p>
                  </div>
                ))}

                {/* Formula visualization */}
                <div className="bg-[#141414] rounded-lg p-4 mt-4">
                  <p className="text-[10px] text-[#8e8e8e] mb-2">Berekening:</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                    {analysis.scoring.map((row, i) => (
                      <span key={row.criterion} className="flex items-center gap-1">
                        {i > 0 && <span className="text-[#6b6b6b]">+</span>}
                        <span className="text-[#8e8e8e]">({row.score}/5</span>
                        <span className="text-[#6b6b6b]">&times;</span>
                        <span className="text-amber-400">{row.weight}%</span>
                        <span className="text-[#8e8e8e]">)</span>
                      </span>
                    ))}
                    <span className="text-[#6b6b6b]">=</span>
                    <span
                      className="text-lg font-bold"
                      style={{
                        color:
                          analysis.weightedTotal >= 80
                            ? "#22c55e"
                            : analysis.weightedTotal >= 65
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      {analysis.weightedTotal}%
                    </span>
                  </div>
                </div>
              </div>
            </StepCard>

            <ArrowConnector active={currentStep >= 5} />

            {/* Step 5: Risk Assessment */}
            <StepCard
              step={5}
              title="Risico Beoordeling"
              description="Combineer knock-outs en score tot risicoprofiel"
              icon={AlertTriangle}
              color={
                analysis.riskLevel === "Laag"
                  ? "#22c55e"
                  : analysis.riskLevel === "Gemiddeld"
                    ? "#f59e0b"
                    : "#ef4444"
              }
              active={currentStep >= 5}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div
                    className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl ${
                      analysis.riskLevel === "Laag"
                        ? "bg-[#22c55e]/20"
                        : analysis.riskLevel === "Gemiddeld"
                          ? "bg-amber-500/20"
                          : "bg-red-500/20"
                    }`}
                  >
                    <Shield
                      className={`h-8 w-8 ${
                        analysis.riskLevel === "Laag"
                          ? "text-[#22c55e]"
                          : analysis.riskLevel === "Gemiddeld"
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-[#ececec]">
                        Risico: {analysis.riskLevel}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          analysis.riskLevel === "Laag"
                            ? "border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/10"
                            : analysis.riskLevel === "Gemiddeld"
                              ? "border-amber-400/30 text-amber-400 bg-amber-400/10"
                              : "border-red-400/30 text-red-400 bg-red-400/10"
                        }`}
                      >
                        {analysis.riskLevel === "Laag"
                          ? "Doorgaan"
                          : analysis.riskLevel === "Gemiddeld"
                            ? "Nader bekijken"
                            : "Afwijzen / heroverweeg"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#8e8e8e] mt-1">
                      {analysis.riskExplanation}
                    </p>
                  </div>
                </div>
                {/* Decision tree visual */}
                <div className="bg-[#141414] rounded-lg p-4 text-xs">
                  <p className="text-[10px] text-[#8e8e8e] mb-3">Beslisboom:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-[#8e8e8e]" />
                      <span className="text-[#8e8e8e]">Alle knock-outs voldaan?</span>
                      <ChevronRight className="h-3 w-3 text-[#6b6b6b]" />
                      {analysis.allKnockOutsMet ? (
                        <span className="text-[#22c55e]">Ja</span>
                      ) : (
                        <span className="text-red-400">Nee → Hoog risico</span>
                      )}
                    </div>
                    {analysis.allKnockOutsMet && (
                      <div className="flex items-center gap-2 ml-5">
                        <GitBranch className="h-3.5 w-3.5 text-[#8e8e8e]" />
                        <span className="text-[#8e8e8e]">Score &ge; 80%?</span>
                        <ChevronRight className="h-3 w-3 text-[#6b6b6b]" />
                        {analysis.weightedTotal >= 80 ? (
                          <span className="text-[#22c55e]">Ja → Laag risico</span>
                        ) : analysis.weightedTotal >= 65 ? (
                          <span className="text-amber-400">
                            Nee ({analysis.weightedTotal}%) → Score &ge; 65% → Gemiddeld
                          </span>
                        ) : (
                          <span className="text-red-400">
                            Nee ({analysis.weightedTotal}%) → Hoog risico
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </StepCard>

            <ArrowConnector active={currentStep >= 6} />

            {/* Step 6: Final Verdict */}
            <StepCard
              step={6}
              title="Eindoordeel & Aanbevelingen"
              description="Conclusie en concrete vervolgstappen"
              icon={Sparkles}
              color="#10a37f"
              active={currentStep >= 6}
            >
              <div className="space-y-4">
                {/* Big score */}
                <div className="flex items-center justify-center">
                  <div
                    className="relative flex items-center justify-center h-32 w-32 rounded-full border-4"
                    style={{
                      borderColor:
                        analysis.overallScore >= 80
                          ? "#22c55e"
                          : analysis.overallScore >= 65
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  >
                    <div className="text-center">
                      <p
                        className="text-4xl font-bold"
                        style={{
                          color:
                            analysis.overallScore >= 80
                              ? "#22c55e"
                              : analysis.overallScore >= 65
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      >
                        {analysis.overallScore}
                      </p>
                      <p className="text-[10px] text-[#8e8e8e]">van 100</p>
                    </div>
                  </div>
                </div>

                {/* Grade label */}
                <div className="text-center">
                  <Badge
                    className={`text-sm px-4 py-1 ${
                      analysis.overallScore >= 80
                        ? "bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/20"
                        : analysis.overallScore >= 65
                          ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20"
                          : "bg-red-500/15 text-red-400 hover:bg-red-500/20"
                    }`}
                  >
                    {analysis.overallScore >= 80
                      ? "Sterke Match"
                      : analysis.overallScore >= 65
                        ? "Matige Match"
                        : "Zwakke Match"}
                  </Badge>
                </div>

                {/* Summary metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#141414] rounded-lg p-3 text-center">
                    <p className="text-xs font-bold text-[#ececec]">
                      {analysis.matchedSkills.length}/{analysis.job.requiredSkills.length}
                    </p>
                    <p className="text-[9px] text-[#6b6b6b]">Skills match</p>
                  </div>
                  <div className="bg-[#141414] rounded-lg p-3 text-center">
                    <p
                      className="text-xs font-bold"
                      style={{
                        color:
                          analysis.riskLevel === "Laag"
                            ? "#22c55e"
                            : analysis.riskLevel === "Gemiddeld"
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      {analysis.riskLevel}
                    </p>
                    <p className="text-[9px] text-[#6b6b6b]">Risico</p>
                  </div>
                  <div className="bg-[#141414] rounded-lg p-3 text-center">
                    <p className="text-xs font-bold text-[#ececec]">
                      {analysis.allKnockOutsMet ? "Ja" : "Nee"}
                    </p>
                    <p className="text-[9px] text-[#6b6b6b]">Knock-outs ok</p>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <p className="text-xs font-semibold text-[#ececec]">
                      Aanbevelingen
                    </p>
                  </div>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 bg-[#141414] rounded-lg px-4 py-3"
                      >
                        <TrendingUp className="h-3.5 w-3.5 text-[#10a37f] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#ececec]">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StepCard>
          </div>
        )}

        {/* Empty state */}
        {!candidate && !job && (
          <div className="text-center py-16">
            <Brain className="h-16 w-16 text-[#2d2d2d] mx-auto mb-4" />
            <p className="text-lg font-medium text-[#6b6b6b]">
              Selecteer een kandidaat en opdracht
            </p>
            <p className="text-sm text-[#6b6b6b] mt-1">
              om de visuele analyse te starten
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
