"use client"

import { useState } from "react"
import { Sparkles, Search, Filter, ArrowUpDown, ChevronRight, X, FileText, LogOut, Download, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react"

import { AssessmentRadar } from "./components/radar-chart"

// --- Mock Data ---

interface Candidate {
  id: string
  score: number
  name: string
  grade: "Excellent" | "Strong" | "Good" | "Below"
  role: string
  experience: string
  metrics: {
    skill: number
    relevance: number
    quality: number
  }
  tags: string[]
  radar: { subject: string; A: number; fullMark: number }[]
  matchedSkills: string[]
  strengths: string[]
  suggestions: string[]
  initials: string
}

const mockCandidates: Candidate[] = [
  {
    id: "1",
    score: 94,
    name: "Sarah Chen",
    grade: "Excellent",
    role: "Senior Frontend Engineer",
    experience: "7 years experience",
    metrics: { skill: 93, relevance: 92, quality: 96 },
    tags: ["React", "TypeScript", "Next.js", "GraphQL", "+1 more"],
    radar: [
      { subject: "Skill Match", A: 93, fullMark: 100 },
      { subject: "Relevance", A: 92, fullMark: 100 },
      { subject: "Resume Quality", A: 96, fullMark: 100 },
      { subject: "Experience", A: 90, fullMark: 100 },
      { subject: "Education", A: 85, fullMark: 100 },
    ],
    matchedSkills: ["React", "TypeScript", "Next.js", "GraphQL", "Tailwind CSS"],
    strengths: ["React", "TypeScript", "Next.js"],
    suggestions: ["Consider adding more metrics to past achievements."],
    initials: "SC",
  },
  {
    id: "2",
    score: 93,
    name: "Raj Gupta",
    grade: "Excellent",
    role: "Cloud Architect",
    experience: "9 years experience",
    metrics: { skill: 91, relevance: 94, quality: 95 },
    tags: ["AWS", "Azure", "GCP", "Terraform", "+1 more"],
    radar: [
      { subject: "Skill Match", A: 91, fullMark: 100 },
      { subject: "Relevance", A: 94, fullMark: 100 },
      { subject: "Resume Quality", A: 95, fullMark: 100 },
      { subject: "Experience", A: 92, fullMark: 100 },
      { subject: "Education", A: 80, fullMark: 100 },
    ],
    matchedSkills: ["AWS", "Azure", "GCP", "Terraform", "Security"],
    strengths: ["AWS", "Azure", "GCP"],
    suggestions: ["Consider adding leadership examples"],
    initials: "RG",
  },
  {
    id: "3",
    score: 91,
    name: "Aisha Patel",
    grade: "Excellent",
    role: "ML Engineer",
    experience: "5 years experience",
    metrics: { skill: 89, relevance: 93, quality: 92 },
    tags: ["Python", "TensorFlow", "PyTorch", "MLOps", "+1 more"],
    radar: [
      { subject: "Skill Match", A: 89, fullMark: 100 },
      { subject: "Relevance", A: 93, fullMark: 100 },
      { subject: "Resume Quality", A: 92, fullMark: 100 },
      { subject: "Experience", A: 80, fullMark: 100 },
      { subject: "Education", A: 95, fullMark: 100 },
    ],
    matchedSkills: ["Python", "TensorFlow", "PyTorch", "MLOps"],
    strengths: ["Python", "PyTorch", "MLOps"],
    suggestions: ["Elaborate on specific model architectures built."],
    initials: "AP",
  },
  {
    id: "4",
    score: 89,
    name: "Yuki Tanaka",
    grade: "Strong",
    role: "Data Scientist",
    experience: "4 years experience",
    metrics: { skill: 88, relevance: 89, quality: 91 },
    tags: ["Python", "R", "SQL", "Tableau", "+1 more"],
    radar: [
      { subject: "Skill Match", A: 88, fullMark: 100 },
      { subject: "Relevance", A: 89, fullMark: 100 },
      { subject: "Resume Quality", A: 91, fullMark: 100 },
      { subject: "Experience", A: 75, fullMark: 100 },
      { subject: "Education", A: 90, fullMark: 100 },
    ],
    matchedSkills: ["Python", "R", "SQL", "Tableau", "Machine Learning"],
    strengths: ["Statistical Analysis", "Data Visualization"],
    suggestions: ["Focus more on deployment experience."],
    initials: "YT",
  },
  {
    id: "5",
    score: 88,
    name: "Marcus Johnson",
    grade: "Strong",
    role: "Full Stack Developer",
    experience: "6 years experience",
    metrics: { skill: 90, relevance: 88, quality: 85 },
    tags: ["Node.js", "React", "PostgreSQL", "AWS", "+1 more"],
    radar: [
      { subject: "Skill Match", A: 90, fullMark: 100 },
      { subject: "Relevance", A: 88, fullMark: 100 },
      { subject: "Resume Quality", A: 85, fullMark: 100 },
      { subject: "Experience", A: 85, fullMark: 100 },
      { subject: "Education", A: 82, fullMark: 100 },
    ],
    matchedSkills: ["Node.js", "React", "PostgreSQL", "AWS"],
    strengths: ["Backend Architecture", "API Design"],
    suggestions: ["Improve formatting of work history."],
    initials: "MJ",
  },
]

// --- Helper Functions ---

const getGradeColor = (grade: Candidate["grade"]) => {
  switch (grade) {
    case "Excellent":
      return "text-emerald-700 bg-emerald-100 border-emerald-200"
    case "Strong":
      return "text-blue-700 bg-blue-100 border-blue-200"
    case "Good":
      return "text-yellow-700 bg-yellow-100 border-yellow-200"
    case "Below":
      return "text-rose-700 bg-rose-100 border-rose-200"
  }
}

const getScoreRingColor = (score: number) => {
  if (score >= 90) return "text-emerald-500 border-emerald-500"
  if (score >= 80) return "text-blue-500 border-blue-500"
  if (score >= 70) return "text-yellow-500 border-yellow-500"
  return "text-rose-500 border-rose-500"
}

// --- Component ---

export default function AIGradingPage() {
  const [selectedId, setSelectedId] = useState<string>("2")
  const selectedCandidate = mockCandidates.find((c) => c.id === selectedId) || mockCandidates[0]

  return (
    <div className="flex flex-col h-full bg-[#fcfcfc]">
      {/* Header */}
      <header className="px-6 py-5 border-b bg-white">
        <h1 className="text-xl font-semibold mb-1">AI Resume Grading</h1>
        <p className="text-sm text-muted-foreground">
          Instant assessment based on skill matching, relevance & quality metrics.
        </p>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-6 items-start h-full">
          {/* Left Column: List */}
          <div className="flex flex-col gap-6">
            {/* Banner */}
            <div className="p-4 bg-white border rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">AI Resume Grading</h2>
                  <p className="text-sm text-muted-foreground">
                    Instant assessment based on skill matching, relevance & quality
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  10 Graded
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-sm font-medium">
                  <LogOut className="w-3.5 h-3.5 rotate-180" /> {/* Generic bias icon placeholder */}
                  Bias-Free
                </span>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search candidates..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium bg-white hover:bg-gray-50">
                <Filter className="w-4 h-4" /> All Grades
              </button>
              <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium bg-white hover:bg-gray-50">
                <ArrowUpDown className="w-4 h-4" /> By Score
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-white border rounded-lg flex items-center justify-between shadow-xs">
                <span className="text-sm font-medium text-gray-600">Excellent</span>
                <span className="text-lg font-bold text-emerald-600">3</span>
              </div>
              <div className="p-3 bg-white border rounded-lg flex items-center justify-between shadow-xs">
                <span className="text-sm font-medium text-gray-600">Strong</span>
                <span className="text-lg font-bold text-blue-600">4</span>
              </div>
              <div className="p-3 bg-white border rounded-lg flex items-center justify-between shadow-xs">
                <span className="text-sm font-medium text-gray-600">Good</span>
                <span className="text-lg font-bold text-yellow-600">3</span>
              </div>
              <div className="p-3 bg-white border rounded-lg flex items-center justify-between shadow-xs">
                <span className="text-sm font-medium text-gray-600">Below</span>
                <span className="text-lg font-bold text-rose-600">0</span>
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex flex-col gap-3">
              {mockCandidates.map((cad) => {
                const isSelected = cad.id === selectedId
                return (
                  <div
                    key={cad.id}
                    onClick={() => setSelectedId(cad.id)}
                    className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                      isSelected ? "border-blue-500 bg-blue-50/20 shadow-sm" : "bg-white hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg bg-white ${getScoreRingColor(
                        cad.score,
                      )}`}
                    >
                      {cad.score}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{cad.name}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${getGradeColor(
                            cad.grade,
                          )} font-medium`}
                        >
                          {cad.grade}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{cad.role}</p>

                      <div className="flex flex-wrap gap-2">
                        {cad.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-md font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-48 shrink-0 py-1">
                      {[
                        { label: "Skill", val: cad.metrics.skill },
                        { label: "Rel.", val: cad.metrics.relevance },
                        { label: "Qual.", val: cad.metrics.quality },
                      ].map((m) => (
                        <div key={m.label} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-8 shrink-0">{m.label}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${m.val}%` }}></div>
                          </div>
                          <span className="text-xs font-semibold w-8 text-right shrink-0">{m.val}%</span>
                        </div>
                      ))}
                    </div>

                    <ChevronRight className={`w-5 h-5 mt-4 ${isSelected ? "text-blue-500" : "text-gray-300"}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Selected Detail */}
          <div className="sticky top-6 flex flex-col gap-4 bg-white border p-6 rounded-2xl shadow-xs">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg">
                  {selectedCandidate.initials}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedCandidate.name}</h2>
                  <p className="text-sm text-gray-600">{selectedCandidate.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${getGradeColor(
                        selectedCandidate.grade,
                      )} font-medium uppercase tracking-wide`}
                    >
                      {selectedCandidate.grade}
                    </span>
                    <span className="text-xs text-gray-500">{selectedCandidate.experience}</span>
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Radar Chart */}
            <div className="mt-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-sm">AI Assessment Breakdown</h3>
              </div>
              <AssessmentRadar data={selectedCandidate.radar} />
            </div>

            {/* Top Scores */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3 text-center flex flex-col justify-center">
                <span className="text-xl font-bold text-blue-600">{selectedCandidate.metrics.skill}%</span>
                <span className="text-xs text-muted-foreground mt-0.5">Skill Match</span>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3 text-center flex flex-col justify-center">
                <span className="text-xl font-bold text-emerald-600">{selectedCandidate.metrics.relevance}%</span>
                <span className="text-xs text-muted-foreground mt-0.5">Relevance</span>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3 text-center flex flex-col justify-center">
                <span className="text-xl font-bold text-purple-600">{selectedCandidate.metrics.quality}%</span>
                <span className="text-xs text-muted-foreground mt-0.5">Quality</span>
              </div>
            </div>

            {/* Breakdown Lists */}
            <div className="mt-2 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Matched Skills</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.matchedSkills.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-xs font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-semibold text-sm text-emerald-700">Strengths</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {selectedCandidate.strengths.map((str, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-sm text-amber-700">Suggestions</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {selectedCandidate.suggestions.map((sug, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-sm text-gray-600">
                        <AlertCircle className="w-4 h-4 text-amber-200 shrink-0 mt-0.5" />
                        <span className="leading-snug">{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 mt-4 border-t">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                <FileText className="w-4 h-4" /> View Resume
              </button>
              <button className="flex-1 bg-white hover:bg-gray-50 border text-gray-800 font-medium py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                <Sparkles className="w-4 h-4" /> Match to Job
              </button>
              <button className="flex-1 bg-white hover:bg-gray-50 border text-gray-800 font-medium py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                <Download className="w-4 h-4" /> Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
