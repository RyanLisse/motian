"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import type { Candidate, Job } from "@/lib/data"

// DB match shape from /api/matches
interface DbMatch {
  id: string
  jobId: string
  candidateId: string
  vectorScore: number | null
  llmScore: number | null
  overallScore: number | null
  status: string
  knockOutPassed: boolean | null
  matchData: Record<string, unknown> | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  jobTitle: string | null
  candidateName: string | null
}
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Brain,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  ArrowLeft,
  Star,
  Shield,
  Lightbulb,
} from "lucide-react"
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeInfo(score: number) {
  if (score >= 90)
    return {
      label: "Excellent",
      bg: "bg-[#22c55e]/15",
      text: "text-[#22c55e]",
      stroke: "#22c55e",
    }
  if (score >= 80)
    return {
      label: "Sterk",
      bg: "bg-[#10a37f]/15",
      text: "text-[#10a37f]",
      stroke: "#10a37f",
    }
  if (score >= 70)
    return {
      label: "Goed",
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      stroke: "#f59e0b",
    }
  return {
    label: "Onder drempel",
    bg: "bg-red-500/15",
    text: "text-red-400",
    stroke: "#ef4444",
  }
}

function parseYears(exp: string): number {
  const m = exp.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// ---------------------------------------------------------------------------
// ScoreRing
// ---------------------------------------------------------------------------

function ScoreRing({
  score,
  size = 56,
  strokeWidth = 5,
}: {
  score: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const { stroke } = gradeInfo(score)

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#2d2d2d"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-[#ececec] text-sm font-bold"
        style={{ fontSize: size * 0.28 }}
      >
        {score}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// GradeLabel
// ---------------------------------------------------------------------------

function GradeLabel({ score }: { score: number }) {
  const g = gradeInfo(score)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${g.bg} ${g.text}`}
    >
      {g.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Match report generation helpers
// ---------------------------------------------------------------------------

interface KnockOutRow {
  criterion: string
  required: boolean
  met: boolean
  evidence: string
}

interface ScoreRow {
  criterion: string
  weight: number
  score: number
  explanation: string
}

interface MatchReport {
  overallScore: number
  knockOut: KnockOutRow[]
  scoring: ScoreRow[]
  riskLevel: "Laag" | "Gemiddeld" | "Hoog"
  riskExplanation: string
  recommendations: string[]
}

function generateMatchReport(candidate: Candidate, job: Job): MatchReport {
  const matchedSkills = job.requiredSkills.filter((s) =>
    candidate.skills.some((cs) => cs.toLowerCase() === s.toLowerCase())
  )
  const years = parseYears(candidate.experience)

  // Knock-out criteria
  const knockOut: KnockOutRow[] = [
    {
      criterion: "Vereiste Ervaring (3+ jaar)",
      required: true,
      met: years >= 3,
      evidence:
        years >= 3
          ? `${years} jaar ervaring voldoet aan minimum`
          : `${years} jaar ervaring onder het minimum van 3 jaar`,
    },
    ...job.requiredSkills.map((skill) => {
      const has = candidate.skills.some(
        (cs) => cs.toLowerCase() === skill.toLowerCase()
      )
      return {
        criterion: skill,
        required: true,
        met: has,
        evidence: has
          ? `${skill} aanwezig in profiel`
          : `${skill} ontbreekt in profiel`,
      }
    }),
    {
      criterion: "Locatie compatibiliteit",
      required: false,
      met: candidate.location === job.location,
      evidence:
        candidate.location === job.location
          ? `Locatie ${candidate.location} komt overeen`
          : `Kandidaat in ${candidate.location}, opdracht in ${job.location}`,
    },
  ]

  // Score criteria
  const skillScore = Math.min(5, Math.round((candidate.skillMatch / 100) * 5))
  const expScore = Math.min(5, Math.round((Math.min(years, 10) / 10) * 5))
  const problemScore = Math.min(
    5,
    Math.round(((candidate.skillMatch + candidate.relevance) / 200) * 5)
  )
  const commScore = Math.min(
    5,
    Math.round(((candidate.resumeQuality + candidate.relevance) / 200) * 5)
  )
  const cultureFitScore = Math.min(
    5,
    Math.round(
      ((candidate.relevance + candidate.resumeQuality + candidate.skillMatch) /
        300) *
        5
    )
  )

  const scoring: ScoreRow[] = [
    {
      criterion: "Technische Skills",
      weight: 30,
      score: skillScore,
      explanation: `${matchedSkills.length}/${job.requiredSkills.length} vereiste skills aanwezig`,
    },
    {
      criterion: "Ervaring",
      weight: 25,
      score: expScore,
      explanation: `${years} jaar relevante ervaring`,
    },
    {
      criterion: "Probleemoplossend vermogen",
      weight: 20,
      score: problemScore,
      explanation:
        problemScore >= 4
          ? "Sterk analytisch profiel"
          : "Gemiddeld analytisch vermogen",
    },
    {
      criterion: "Communicatie",
      weight: 15,
      score: commScore,
      explanation:
        commScore >= 4
          ? "Uitstekende communicatieve vaardigheden"
          : "Voldoende communicatieve vaardigheden",
    },
    {
      criterion: "Culturele Fit",
      weight: 10,
      score: cultureFitScore,
      explanation:
        cultureFitScore >= 4
          ? "Sterke aansluiting bij teamcultuur"
          : "Redelijke aansluiting bij teamcultuur",
    },
  ]

  const weightedTotal = scoring.reduce(
    (sum, r) => sum + (r.score / 5) * r.weight,
    0
  )
  const overallScore = Math.round(weightedTotal)

  const allKnockOutsMet = knockOut.filter((k) => k.required).every((k) => k.met)

  let riskLevel: "Laag" | "Gemiddeld" | "Hoog"
  let riskExplanation: string
  if (!allKnockOutsMet) {
    riskLevel = "Hoog"
    riskExplanation =
      "Een of meer knock-out criteria zijn niet voldaan. Aanvullende evaluatie vereist."
  } else if (overallScore >= 80) {
    riskLevel = "Laag"
    riskExplanation =
      "Kandidaat scoort hoog op alle dimensies en voldoet aan alle vereisten."
  } else if (overallScore >= 65) {
    riskLevel = "Gemiddeld"
    riskExplanation =
      "Kandidaat voldoet aan basisvereisten maar heeft ontwikkelpunten."
  } else {
    riskLevel = "Hoog"
    riskExplanation =
      "Lage score op meerdere dimensies. Overweeg andere kandidaten."
  }

  let recommendations: string[]
  if (overallScore >= 80) {
    recommendations = [
      "Direct uitnodigen voor een verdiepend technisch interview.",
      "Referenties opvragen om technische claims te valideren.",
      "Aanbod voorbereiden - kandidaat is gewild op de markt.",
    ]
  } else if (overallScore >= 65) {
    recommendations = [
      "Telefonisch screening inplannen om motivatie te peilen.",
      "Skill assessment uitvoeren voor ontbrekende vaardigheden.",
      "Verificeer ervaring via portfolio of referenties.",
    ]
  } else {
    recommendations = [
      "Overweeg kandidaat voor een alternatieve opdracht.",
      "Eventueel traject met bijscholing bespreken.",
      "Andere kandidaten met betere match prioriteren.",
    ]
  }

  return {
    overallScore,
    knockOut,
    scoring,
    riskLevel,
    riskExplanation,
    recommendations,
  }
}

// ---------------------------------------------------------------------------
// Strengths & Suggestions generator
// ---------------------------------------------------------------------------

function getStrengths(c: Candidate): string[] {
  const items: string[] = []
  if (c.skillMatch >= 90) items.push(`Uitstekende skill match (${c.skillMatch}%)`)
  if (c.relevance >= 88) items.push(`Hoge relevantie score (${c.relevance}%)`)
  if (c.resumeQuality >= 88) items.push(`Top CV kwaliteit (${c.resumeQuality}%)`)
  if (parseYears(c.experience) >= 6)
    items.push(`Ruime ervaring (${c.experience})`)
  if (c.skills.length >= 5) items.push(`Breed skillset (${c.skills.length} skills)`)
  if (c.score >= 90) items.push("Overall excellent profiel")
  return items.slice(0, 3)
}

function getSuggestions(c: Candidate): string[] {
  const items: string[] = []
  if (c.resumeQuality < 80)
    items.push("CV kan verbeterd worden met meer detail over projecten.")
  if (c.skillMatch < 85)
    items.push("Overweeg aanvullende skill assessment voor specifieke gaps.")
  if (parseYears(c.experience) < 4)
    items.push("Beperkte ervaring - plan een technisch interview in.")
  if (c.relevance < 80)
    items.push("Relevantie kan versterkt worden met gerichtere opdrachtkeuze.")
  if (c.skills.length < 4)
    items.push("Smal skillset - verifieer bereidheid om bij te leren.")
  if (items.length === 0)
    items.push("Geen significante verbeterpunten geidentificeerd.")
  return items.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Star Rating helper
// ---------------------------------------------------------------------------

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
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

export default function MatchingPage() {
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Jobs list (fetched from API, no mock data)
  const [positionsList, setPositionsList] = useState<Job[]>([])

  // Database matches
  const [dbMatches, setDbMatches] = useState<DbMatch[]>([])
  const [dbMatchesLoading, setDbMatchesLoading] = useState(true)

  // Match dialog
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [matchCandidate, setMatchCandidate] = useState<Candidate | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string>("")
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null)
  const [isMatchLoading, setIsMatchLoading] = useState(false)
  const [matchSource, setMatchSource] = useState<"ai" | "algorithmic" | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  // Fetch database matches and jobs
  useEffect(() => {
    setDbMatchesLoading(true)
    fetch("/api/matches?limit=50")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DbMatch[]) => setDbMatches(Array.isArray(data) ? data : []))
      .catch(() => setDbMatches([]))
      .finally(() => setDbMatchesLoading(false))

    fetch("/api/jobs?limit=50")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Job[]) => setPositionsList(Array.isArray(data) ? data : []))
      .catch(() => setPositionsList([]))
  }, [])

  const candidates: Candidate[] = []

  // Handle approve/reject for DB matches
  async function handleMatchAction(matchId: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/matches/${matchId}/${action}`, { method: "PATCH" })
      if (res.ok) {
        const updated = await res.json()
        setDbMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, status: updated.status } : m))
        )
        showToast(`Match ${action === "approve" ? "goedgekeurd" : "afgewezen"}`)
      } else {
        showToast("Actie mislukt")
      }
    } catch {
      showToast("Netwerkfout bij match actie")
    }
  }

  // Filtering & sorting
  const filtered = useMemo(() => {
    let list = [...candidates]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q))
      )
    }

    if (gradeFilter !== "all") {
      list = list.filter((c) => {
        if (gradeFilter === "excellent") return c.score >= 90
        if (gradeFilter === "sterk") return c.score >= 80 && c.score < 90
        if (gradeFilter === "goed") return c.score >= 70 && c.score < 80
        if (gradeFilter === "onder") return c.score < 70
        return true
      })
    }

    list.sort((a, b) => {
      if (sortBy === "score") return b.score - a.score
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "date")
        return (
          new Date(b.appliedDate).getTime() -
          new Date(a.appliedDate).getTime()
        )
      return 0
    })

    return list
  }, [search, gradeFilter, sortBy])

  const selected = selectedId
    ? candidates.find((c) => c.id === selectedId) ?? null
    : null

  // Summary counts
  const excellent = candidates.filter((c) => c.score >= 90).length
  const sterk = candidates.filter(
    (c) => c.score >= 80 && c.score < 90
  ).length
  const goed = candidates.filter(
    (c) => c.score >= 70 && c.score < 80
  ).length
  const onder = candidates.filter((c) => c.score < 70).length

  function openMatchDialog(c: Candidate) {
    setMatchCandidate(c)
    setSelectedJobId("")
    setMatchReport(null)
    setMatchDialogOpen(true)
  }

  async function runMatchAnalysis() {
    if (!matchCandidate || !selectedJobId) return
    const job = positionsList.find((j) => j.id === selectedJobId)
    if (!job) return

    setIsMatchLoading(true)
    setMatchSource(null)

    try {
      // Try AI-powered matching first
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: matchCandidate, job }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.result) {
          const r = data.result
          setMatchReport({
            overallScore: r.overallScore,
            knockOut: r.knockOutCriteria,
            scoring: r.scoringCriteria.map((s: { criterion: string; weight: number; score: number; explanation: string }) => ({
              criterion: s.criterion,
              weight: s.weight,
              score: s.score,
              explanation: s.explanation,
            })),
            riskLevel: r.riskLevel,
            riskExplanation: r.riskExplanation,
            recommendations: r.recommendations,
          })
          setMatchSource("ai")
          setIsMatchLoading(false)
          return
        }
      }
      // If AI fails (no API key, error, etc.), fall back to algorithmic
      throw new Error("AI unavailable")
    } catch {
      // Fallback to algorithmic matching
      setMatchReport(generateMatchReport(matchCandidate, job))
      setMatchSource("algorithmic")
    } finally {
      setIsMatchLoading(false)
    }
  }

  function exportCandidate(c: Candidate) {
    const text = `Kandidaat: ${c.name}\nRol: ${c.role}\nScore: ${c.score}\nSkills: ${c.skills.join(", ")}\nErvaring: ${c.experience}\nSkill Match: ${c.skillMatch}%\nRelevantie: ${c.relevance}%\nCV Kwaliteit: ${c.resumeQuality}%`
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${c.name.replace(/\s+/g, "-").toLowerCase()}-rapport.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(`Rapport voor ${c.name} geexporteerd`)
  }

  // Radar data for selected candidate
  const radarData = selected
    ? [
        { axis: "Skill Match", value: selected.skillMatch },
        { axis: "Relevantie", value: selected.relevance },
        { axis: "CV Kwaliteit", value: selected.resumeQuality },
        {
          axis: "Ervaring",
          value: Math.min(100, parseYears(selected.experience) * 10),
        },
        {
          axis: "Opleiding",
          value: Math.round(
            (selected.skillMatch + selected.resumeQuality) / 2
          ),
        },
      ]
    : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* ---- Header ---- */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10a37f]/10">
              <Brain className="h-6 w-6 text-[#10a37f]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#ececec]">
                AI Kandidaat Matching
              </h1>
              <p className="text-sm text-[#6b6b6b] mt-0.5">
                Score kandidaten en match ze aan opdrachten
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-[#10a37f]/30 text-[#10a37f] bg-[#10a37f]/10"
            >
              {candidates.length} Beoordeeld
            </Badge>
            <Badge
              variant="outline"
              className="border-[#2d2d2d] text-[#8e8e8e] bg-[#141414]"
            >
              <Shield className="h-3 w-3 mr-1" />
              Bias-Vrij
            </Badge>
          </div>
        </div>

        {/* ---- Summary Cards ---- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
            <p className="text-xs text-[#6b6b6b]">Excellent (90+)</p>
            <p className="text-2xl font-bold text-[#22c55e] mt-1">
              {excellent}
            </p>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
            <p className="text-xs text-[#6b6b6b]">Sterk (80-89)</p>
            <p className="text-2xl font-bold text-blue-500 mt-1">{sterk}</p>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
            <p className="text-xs text-[#6b6b6b]">Goed (70-79)</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{goed}</p>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
            <p className="text-xs text-[#6b6b6b]">Onder drempel (&lt;70)</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{onder}</p>
          </Card>
        </div>

        {/* ---- Database Matches ---- */}
        {dbMatchesLoading ? (
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-6">
            <p className="text-sm text-[#6b6b6b]">Laden...</p>
          </Card>
        ) : dbMatches.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#ececec]">
              Database Matches ({dbMatches.length})
            </h2>
            <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                    <TableHead className="text-[#8e8e8e] text-xs">Kandidaat</TableHead>
                    <TableHead className="text-[#8e8e8e] text-xs">Opdracht</TableHead>
                    <TableHead className="text-[#8e8e8e] text-xs">Score</TableHead>
                    <TableHead className="text-[#8e8e8e] text-xs">Status</TableHead>
                    <TableHead className="text-[#8e8e8e] text-xs">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbMatches.map((m) => (
                    <TableRow key={m.id} className="border-[#2d2d2d]">
                      <TableCell className="text-sm text-[#ececec]">
                        {m.candidateName ?? m.candidateId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm text-[#ececec]">
                        {m.jobTitle ?? m.jobId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm font-mono font-bold"
                          style={{
                            color:
                              (m.overallScore ?? 0) >= 80
                                ? "#22c55e"
                                : (m.overallScore ?? 0) >= 60
                                  ? "#f59e0b"
                                  : "#ef4444",
                          }}
                        >
                          {m.overallScore != null ? `${Math.round(m.overallScore)}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.status === "approved"
                              ? "border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/10 text-[10px]"
                              : m.status === "rejected"
                                ? "border-red-400/30 text-red-400 bg-red-400/10 text-[10px]"
                                : "border-[#2d2d2d] text-[#8e8e8e] text-[10px]"
                          }
                        >
                          {m.status === "approved"
                            ? "Goedgekeurd"
                            : m.status === "rejected"
                              ? "Afgewezen"
                              : "In afwachting"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10 bg-transparent"
                              onClick={() => handleMatchAction(m.id, "approve")}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Goedkeuren
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-red-400/30 text-red-400 hover:bg-red-400/10 bg-transparent"
                              onClick={() => handleMatchAction(m.id, "reject")}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Afwijzen
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {/* ---- Filters Row ---- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op naam, rol of skills..."
              className="pl-10 bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/50 focus-visible:border-[#10a37f]"
            />
          </div>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[180px] bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec]">
              <SelectValue placeholder="Grade filter" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
              <SelectItem
                value="all"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Alle
              </SelectItem>
              <SelectItem
                value="excellent"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Excellent (90+)
              </SelectItem>
              <SelectItem
                value="sterk"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Sterk (80-89)
              </SelectItem>
              <SelectItem
                value="goed"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Goed (70-79)
              </SelectItem>
              <SelectItem
                value="onder"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Onder drempel (&lt;70)
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec]">
              <SelectValue placeholder="Sorteer" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
              <SelectItem
                value="score"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Op score
              </SelectItem>
              <SelectItem
                value="name"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Op naam
              </SelectItem>
              <SelectItem
                value="date"
                className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              >
                Op datum
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ---- Split Layout ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Candidate List */}
          <div className={selected ? "lg:col-span-7" : "lg:col-span-12"}>
            <div className="space-y-3">
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-[#6b6b6b]">
                  <Brain className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-lg font-medium">Geen resultaten</p>
                  <p className="text-sm mt-1">
                    Pas je zoekopdracht of filters aan
                  </p>
                </div>
              )}
              {filtered.map((c) => {
                const g = gradeInfo(c.score)
                const maxSkills = 4
                const visibleSkills = c.skills.slice(0, maxSkills)
                const overflow = c.skills.length - maxSkills
                const isSelected = selectedId === c.id

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(isSelected ? null : c.id)
                    }
                    className={`w-full text-left bg-[#1e1e1e] border rounded-xl p-4 transition-all hover:border-[#10a37f]/40 ${
                      isSelected
                        ? "border-[#10a37f] ring-1 ring-[#10a37f]/30"
                        : "border-[#2d2d2d]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Score Ring */}
                      <ScoreRing score={c.score} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#ececec] truncate">
                            {c.name}
                          </span>
                          <GradeLabel score={c.score} />
                        </div>
                        <p className="text-xs text-[#6b6b6b] mt-0.5 truncate">
                          {c.role}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {visibleSkills.map((s) => (
                            <span
                              key={s}
                              className={`px-2 py-0.5 text-[10px] rounded-md ${g.bg} ${g.text}`}
                            >
                              {s}
                            </span>
                          ))}
                          {overflow > 0 && (
                            <span className="px-2 py-0.5 text-[10px] rounded-md bg-[#141414] text-[#6b6b6b]">
                              +{overflow}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Progress bars */}
                      <div className="hidden md:flex flex-col gap-2 w-40 shrink-0">
                        <MiniBar
                          label="Skill Match"
                          value={c.skillMatch}
                          color="#22c55e"
                        />
                        <MiniBar
                          label="Relevantie"
                          value={c.relevance}
                          color="#3b82f6"
                        />
                        <MiniBar
                          label="Kwaliteit"
                          value={c.resumeQuality}
                          color="#f59e0b"
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Detail Panel */}
          {selected && (
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-6 space-y-4">
                <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-5 space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-lg">
                          {selected.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-[#ececec]">
                            {selected.name}
                          </h2>
                          <GradeLabel score={selected.score} />
                        </div>
                        <p className="text-xs text-[#6b6b6b]">
                          {selected.role} &middot; {selected.experience}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-[#6b6b6b] hover:text-[#ececec] transition-colors p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Radar Chart */}
                  <div className="bg-[#141414] rounded-lg p-3">
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        data={radarData}
                      >
                        <PolarGrid stroke="#2d2d2d" />
                        <PolarAngleAxis
                          dataKey="axis"
                          tick={{ fill: "#8e8e8e", fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={false}
                          axisLine={false}
                        />
                        <Radar
                          dataKey="value"
                          stroke="#10a37f"
                          fill="#10a37f"
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <MetricCard
                      label="Skill Match"
                      value={selected.skillMatch}
                      color="#22c55e"
                    />
                    <MetricCard
                      label="Relevantie"
                      value={selected.relevance}
                      color="#3b82f6"
                    />
                    <MetricCard
                      label="CV Kwaliteit"
                      value={selected.resumeQuality}
                      color="#f59e0b"
                    />
                  </div>

                  {/* Matched Skills */}
                  <div>
                    <p className="text-xs font-medium text-[#8e8e8e] mb-2">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.skills.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 text-[10px] rounded-md bg-[#10a37f]/15 text-[#10a37f]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Suggestions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#8e8e8e]">
                        Sterke punten
                      </p>
                      {getStrengths(selected).map((s) => (
                        <div
                          key={s}
                          className="flex items-start gap-2 text-xs text-[#ececec]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e] shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#8e8e8e]">
                        Suggesties
                      </p>
                      {getSuggestions(selected).map((s) => (
                        <div
                          key={s}
                          className="flex items-start gap-2 text-xs text-[#ececec]"
                        >
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#2d2d2d]">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d2d] bg-[#141414] text-[#ececec] hover:bg-[#2d2d2d]"
                      onClick={() => showToast(`CV voor ${selected.name} wordt geladen...`)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Bekijk CV
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#10a37f] text-white hover:bg-[#0e8c6b]"
                      onClick={() => openMatchDialog(selected)}
                    >
                      <Brain className="h-3.5 w-3.5 mr-1.5" />
                      Match aan Opdracht
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d2d] bg-[#141414] text-[#ececec] hover:bg-[#2d2d2d]"
                      onClick={() => exportCandidate(selected)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Exporteer
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Match Dialog ---- */}
      <Dialog
        open={matchDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMatchDialogOpen(false)
            setMatchReport(null)
          }
        }}
      >
        {matchCandidate && (
          <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#ececec]">
                {matchReport ? "Match Rapport" : "Match aan Opdracht"}
              </DialogTitle>
            </DialogHeader>

            {!matchReport ? (
              /* Step 1: Select job */
              <div className="space-y-4">
                {/* Candidate info */}
                <div className="flex items-center gap-3 bg-[#141414] rounded-lg p-3">
                  <ScoreRing score={matchCandidate.score} size={44} />
                  <div>
                    <p className="text-sm font-semibold text-[#ececec]">
                      {matchCandidate.name}
                    </p>
                    <p className="text-xs text-[#6b6b6b]">
                      {matchCandidate.role} &middot;{" "}
                      {matchCandidate.experience}
                    </p>
                  </div>
                </div>

                {/* Job select */}
                <div>
                  <label className="text-xs font-medium text-[#8e8e8e] mb-2 block">
                    Selecteer opdracht
                  </label>
                  <Select
                    value={selectedJobId}
                    onValueChange={setSelectedJobId}
                  >
                    <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] w-full">
                      <SelectValue placeholder="Kies een opdracht..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                      {positionsList.map((j) => (
                        <SelectItem
                          key={j.id}
                          value={j.id}
                          className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                        >
                          {j.title} - {j.department} ({j.location})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full bg-[#10a37f] text-white hover:bg-[#0e8c6b]"
                  disabled={!selectedJobId || isMatchLoading}
                  onClick={runMatchAnalysis}
                >
                  {isMatchLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      AI Analyse bezig...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Start Match Analyse
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Step 2: Full report */
              <div className="space-y-5">
                {/* Back button + source indicator */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2d2d2d] -ml-2"
                    onClick={() => setMatchReport(null)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Terug
                  </Button>
                  {matchSource && (
                    <Badge
                      variant="outline"
                      className={
                        matchSource === "ai"
                          ? "border-[#10a37f]/30 text-[#10a37f] bg-[#10a37f]/10 text-[10px]"
                          : "border-[#2d2d2d] text-[#8e8e8e] text-[10px]"
                      }
                    >
                      {matchSource === "ai" ? "AI-Powered (Claude)" : "Algoritmisch"}
                    </Badge>
                  )}
                </div>

                {/* Overall Score */}
                <Card className="bg-[#141414] border-[#2d2d2d] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[#ececec]">
                      Overall Match Score
                    </p>
                    <span
                      className="text-2xl font-bold"
                      style={{
                        color: gradeInfo(matchReport.overallScore).stroke,
                      }}
                    >
                      {matchReport.overallScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#2d2d2d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${matchReport.overallScore}%`,
                        backgroundColor: gradeInfo(matchReport.overallScore)
                          .stroke,
                      }}
                    />
                  </div>
                </Card>

                {/* Knock-Out Criteria */}
                <div>
                  <p className="text-sm font-medium text-[#ececec] mb-2">
                    Knock-Out Criteria
                  </p>
                  <div className="bg-[#141414] border border-[#2d2d2d] rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Criterium
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Type
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Status
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Toelichting
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchReport.knockOut.map((row) => (
                          <TableRow
                            key={row.criterion}
                            className="border-[#2d2d2d]"
                          >
                            <TableCell className="text-xs text-[#ececec]">
                              {row.criterion}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.required
                                    ? "border-red-500/30 text-red-400 bg-red-500/10 text-[10px]"
                                    : "border-[#2d2d2d] text-[#8e8e8e] text-[10px]"
                                }
                              >
                                {row.required ? "Vereist" : "Optioneel"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.met ? (
                                <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                              ) : (
                                <X className="h-4 w-4 text-red-400" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-[#8e8e8e]">
                              {row.evidence}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Score Criteria */}
                <div>
                  <p className="text-sm font-medium text-[#ececec] mb-2">
                    Score Criteria
                  </p>
                  <div className="bg-[#141414] border border-[#2d2d2d] rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Criterium
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Gewicht
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Score
                          </TableHead>
                          <TableHead className="text-[#8e8e8e] text-xs">
                            Toelichting
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchReport.scoring.map((row) => (
                          <TableRow
                            key={row.criterion}
                            className="border-[#2d2d2d]"
                          >
                            <TableCell className="text-xs text-[#ececec]">
                              {row.criterion}
                            </TableCell>
                            <TableCell className="text-xs text-[#8e8e8e]">
                              {row.weight}%
                            </TableCell>
                            <TableCell>
                              <Stars count={row.score} />
                            </TableCell>
                            <TableCell className="text-xs text-[#8e8e8e]">
                              {row.explanation}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Risk Profile */}
                <Card className="bg-[#141414] border-[#2d2d2d] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-[#8e8e8e]" />
                    <p className="text-sm font-medium text-[#ececec]">
                      Risico Profiel
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        matchReport.riskLevel === "Laag"
                          ? "border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/10 text-[10px]"
                          : matchReport.riskLevel === "Gemiddeld"
                            ? "border-amber-400/30 text-amber-400 bg-amber-400/10 text-[10px]"
                            : "border-red-400/30 text-red-400 bg-red-400/10 text-[10px]"
                      }
                    >
                      {matchReport.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8e8e8e]">
                    {matchReport.riskExplanation}
                  </p>
                </Card>

                {/* Recommendations */}
                <Card className="bg-[#141414] border-[#2d2d2d] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <p className="text-sm font-medium text-[#ececec]">
                      Aanbevelingen
                    </p>
                  </div>
                  <div className="space-y-2">
                    {matchReport.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-[#ececec]"
                      >
                        <span className="text-[#10a37f] font-medium shrink-0">
                          {i + 1}.
                        </span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-4 py-2.5 rounded-lg shadow-xl shadow-black/40 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniBar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-[#6b6b6b]">{label}</span>
        <span className="text-[10px] text-[#8e8e8e] font-mono">{value}%</span>
      </div>
      <div className="h-1.5 bg-[#2d2d2d] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-[#141414] rounded-lg p-3 text-center">
      <p className="text-[10px] text-[#6b6b6b] mb-1">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {value}%
      </p>
    </div>
  )
}
