"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import type { Candidate } from "@/lib/data"

// DB candidate shape from /api/candidates
interface DbCandidate {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  skills: string[]
  experience: string | null
  location: string | null
  province: string | null
  resumeUrl: string | null
  tags: string[]
  source: string | null
  createdAt: string
}

function dbCandidateToUi(db: DbCandidate): Candidate {
  return {
    id: db.id,
    name: db.name,
    email: db.email ?? "",
    role: db.role ?? "Onbekend",
    avatar: db.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join(""),
    score: 0,
    skills: Array.isArray(db.skills) ? db.skills : [],
    experience: db.experience ?? "Onbekend",
    status: "new" as const,
    appliedDate: db.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    source: db.source ?? "database",
    resumeQuality: 0,
    skillMatch: 0,
    relevance: 0,
    location: db.location ?? "Onbekend",
    phone: db.phone ?? "",
    tags: Array.isArray(db.tags) ? db.tags : [],
  }
}
import { CVUpload, type UploadResult } from "@/components/cv-upload"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Filter,
  Download,
  Upload,
  X,
  Users,
  MoreHorizontal,
  Mail,
  Eye,
  Trash2,
  Tag,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Phone,
} from "lucide-react"


function parseExperienceYears(exp: string): number {
  const match = exp.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e"
  if (score >= 80) return "#10a37f"
  if (score >= 70) return "#f59e0b"
  return "#ef4444"
}

function candidatesToCsv(candidates: Candidate[]): string {
  const header = "Naam,Email,Rol,Skills,Locatie,AI Score,Ervaring"
  const rows = candidates.map(
    (c) =>
      `"${c.name}","${c.email}","${c.role}","${c.skills.join(", ")}","${c.location}",${c.score},"${c.experience}"`
  )
  return [header, ...rows].join("\n")
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ProfessionalsPage() {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedExperience, setSelectedExperience] = useState<string>("all")

  // Loading state for database fetch
  const [isLoading, setIsLoading] = useState(true)

  // Local candidate list state for deletion
  const [candidateList, setCandidateList] = useState<Candidate[]>([])

  // Fetch candidates from database, fall back to mock data
  useEffect(() => {
    setIsLoading(true)
    fetch("/api/candidates?limit=100")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed")
        return res.json()
      })
      .then((data: DbCandidate[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCandidateList(data.map(dbCandidateToUi))
        } else {
          setCandidateList([])
        }
      })
      .catch(() => {
        setCandidateList([])
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Derived filter options from loaded candidates
  const ALL_SKILLS = useMemo(
    () => Array.from(new Set(candidateList.flatMap((c) => c.skills))).sort(),
    [candidateList],
  )
  const ALL_LOCATIONS = useMemo(
    () => Array.from(new Set(candidateList.map((c) => c.location))).sort(),
    [candidateList],
  )

  // Toast state
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // View profile dialog state
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null)

  // Delete confirmation state
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null)

  // CV uploader visibility
  const [showUploader, setShowUploader] = useState(false)

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const activeFilterCount =
    selectedSkills.size +
    (selectedLocation !== "all" ? 1 : 0) +
    (selectedExperience !== "all" ? 1 : 0)

  const filtered = useMemo(() => {
    return candidateList.filter((c) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const matchesSearch =
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q)) ||
          c.email.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // Skills
      if (selectedSkills.size > 0) {
        const hasSkill = c.skills.some((s) => selectedSkills.has(s))
        if (!hasSkill) return false
      }

      // Location
      if (selectedLocation !== "all" && c.location !== selectedLocation) {
        return false
      }

      // Experience
      if (selectedExperience !== "all") {
        const years = parseExperienceYears(c.experience)
        if (selectedExperience === "junior" && (years < 1 || years > 3))
          return false
        if (selectedExperience === "mid" && (years < 4 || years > 6))
          return false
        if (selectedExperience === "senior" && years < 7) return false
      }

      return true
    })
  }, [search, selectedSkills, selectedLocation, selectedExperience, candidateList])

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) {
        next.delete(skill)
      } else {
        next.add(skill)
      }
      return next
    })
  }

  function clearFilters() {
    setSelectedSkills(new Set())
    setSelectedLocation("all")
    setSelectedExperience("all")
  }

  // Export filtered candidates
  function handleExportAll() {
    const csv = candidatesToCsv(filtered)
    downloadCsv(csv, "kandidaten-export.csv")
    showToast(`${filtered.length} kandidaten geëxporteerd`)
  }

  // Export selected candidates
  function handleExportSelected() {
    const selected = filtered.filter((c) => selectedIds.has(c.id))
    const csv = candidatesToCsv(selected)
    downloadCsv(csv, "kandidaten-selectie-export.csv")
    showToast(`${selected.length} kandidaten geëxporteerd`)
    setSelectedIds(new Set())
  }

  // Import CV's
  function handleImportClick() {
    setShowUploader((prev) => !prev)
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      showToast(`${files.length} bestanden geselecteerd`)
    }
    // Reset input so the same file can be selected again
    e.target.value = ""
  }

  function handleUploadComplete(result: UploadResult) {
    showToast(`CV geüpload: ${result.originalName}`)
  }

  // Bulk actions
  function handleBulkBericht() {
    showToast(`Bericht wordt verstuurd naar ${selectedIds.size} kandidaten`)
    setSelectedIds(new Set())
  }

  function handleBulkTags() {
    showToast(`Tags bijgewerkt voor ${selectedIds.size} kandidaten`)
    setSelectedIds(new Set())
  }

  // Row-level actions
  function handleViewProfile(c: Candidate) {
    setViewCandidate(c)
  }

  function handleSendMessage(c: Candidate) {
    showToast(`Bericht venster geopend voor ${c.name}`)
  }

  function handleEditTags(c: Candidate) {
    showToast(`Tags bewerken voor ${c.name}`)
  }

  function handleDeleteRequest(c: Candidate) {
    setDeleteCandidate(c)
  }

  function handleDeleteConfirm() {
    if (deleteCandidate) {
      setCandidateList((prev) => prev.filter((c) => c.id !== deleteCandidate.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteCandidate.id)
        return next
      })
      showToast(`${deleteCandidate.name} verwijderd`)
      setDeleteCandidate(null)
    }
  }

  const activeFilters: { label: string; onRemove: () => void }[] = []
  for (const skill of selectedSkills) {
    activeFilters.push({
      label: skill,
      onRemove: () => toggleSkill(skill),
    })
  }
  if (selectedLocation !== "all") {
    activeFilters.push({
      label: selectedLocation,
      onRemove: () => setSelectedLocation("all"),
    })
  }
  if (selectedExperience !== "all") {
    const labels: Record<string, string> = {
      junior: "Junior (1-3 jr)",
      mid: "Mid (4-6 jr)",
      senior: "Senior (7+ jr)",
    }
    activeFilters.push({
      label: labels[selectedExperience] ?? selectedExperience,
      onRemove: () => setSelectedExperience("all"),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#ececec]">Talent Pool</h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              {isLoading ? "Laden..." : `${candidateList.length} profielen ge\u00EFndexeerd`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2d2d2d] bg-[#1e1e1e] text-[#ececec] hover:bg-[#2d2d2d]"
              onClick={handleExportAll}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              size="sm"
              className="bg-[#10a37f] text-white hover:bg-[#0e8c6b]"
              onClick={handleImportClick}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CV&apos;s
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              multiple
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
        </div>

        {/* CV Upload */}
        {showUploader && (
          <CVUpload onUploadComplete={handleUploadComplete} />
        )}

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek op naam, rol of skills..."
                className="pl-10 bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/50 focus-visible:border-[#10a37f]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-[#2d2d2d] bg-[#1e1e1e] text-[#ececec] hover:bg-[#2d2d2d] ${
                activeFilterCount > 0 ? "border-[#10a37f] text-[#10a37f]" : ""
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 bg-[#10a37f] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4 space-y-4">
              {/* Skills */}
              <div>
                <label className="text-xs font-medium text-[#8e8e8e] mb-2 block">
                  Skills
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SKILLS.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        selectedSkills.has(skill)
                          ? "bg-[#10a37f]/15 border-[#10a37f] text-[#10a37f]"
                          : "bg-[#0d0d0d] border-[#2d2d2d] text-[#8e8e8e] hover:border-[#6b6b6b]"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Location */}
                <div className="w-56">
                  <label className="text-xs font-medium text-[#8e8e8e] mb-2 block">
                    Locatie
                  </label>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                  >
                    <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] w-full">
                      <SelectValue placeholder="Alle locaties" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                      <SelectItem
                        value="all"
                        className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                      >
                        Alle locaties
                      </SelectItem>
                      {ALL_LOCATIONS.map((loc) => (
                        <SelectItem
                          key={loc}
                          value={loc}
                          className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                        >
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Experience */}
                <div className="w-56">
                  <label className="text-xs font-medium text-[#8e8e8e] mb-2 block">
                    Ervaringsniveau
                  </label>
                  <Select
                    value={selectedExperience}
                    onValueChange={setSelectedExperience}
                  >
                    <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] w-full">
                      <SelectValue placeholder="Alle niveaus" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                      <SelectItem
                        value="all"
                        className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                      >
                        Alle niveaus
                      </SelectItem>
                      <SelectItem
                        value="junior"
                        className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                      >
                        Junior (1-3 jaar)
                      </SelectItem>
                      <SelectItem
                        value="mid"
                        className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                      >
                        Mid (4-6 jaar)
                      </SelectItem>
                      <SelectItem
                        value="senior"
                        className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                      >
                        Senior (7+ jaar)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2d2d2d] mt-5"
                    >
                      Wis filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Filter Tags */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6b6b6b]">Actieve filters:</span>
              {activeFilters.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-[#10a37f]/10 text-[#10a37f] border border-[#10a37f]/30"
                >
                  {f.label}
                  <button
                    onClick={f.onRemove}
                    className="hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-xs text-[#6b6b6b] hover:text-[#ececec] transition-colors"
              >
                Alles wissen
              </button>
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#10a37f]/10 border border-[#10a37f]/30 rounded-lg px-4 py-2.5">
            <span className="text-sm text-[#10a37f] font-medium">
              {selectedIds.size} geselecteerd
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="border-[#10a37f]/30 text-[#10a37f] hover:bg-[#10a37f]/20 bg-transparent"
                onClick={handleBulkBericht}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Bulk Bericht
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[#10a37f]/30 text-[#10a37f] hover:bg-[#10a37f]/20 bg-transparent"
                onClick={handleBulkTags}
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Tags
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[#10a37f]/30 text-[#10a37f] hover:bg-[#10a37f]/20 bg-transparent"
                onClick={handleExportSelected}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6b6b6b]">
              <Users className="h-12 w-12 mb-3 animate-pulse" />
              <p className="text-lg font-medium">Laden...</p>
              <p className="text-sm mt-1">Kandidaten worden opgehaald</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#6b6b6b]">
              <Users className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">Geen resultaten</p>
              <p className="text-sm mt-1">
                Pas je zoekopdracht of filters aan
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                  <TableHead className="w-10 text-[#8e8e8e]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      className="border-[#2d2d2d] data-[state=checked]:bg-[#10a37f] data-[state=checked]:border-[#10a37f]"
                    />
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    Kandidaat
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    Rol
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    Skills
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    Locatie
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    AI Score
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium">
                    Ervaring
                  </TableHead>
                  <TableHead className="text-[#8e8e8e] text-xs font-medium w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    selected={selectedIds.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                    onViewProfile={() => handleViewProfile(c)}
                    onSendMessage={() => handleSendMessage(c)}
                    onEditTags={() => handleEditTags(c)}
                    onDelete={() => handleDeleteRequest(c)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Results count */}
        {filtered.length > 0 && (
          <p className="text-xs text-[#6b6b6b]">
            {filtered.length} van {candidateList.length} profielen weergegeven
          </p>
        )}
      </div>

      {/* View Profile Dialog */}
      <Dialog open={viewCandidate !== null} onOpenChange={(open) => { if (!open) setViewCandidate(null) }}>
        {viewCandidate && (
          <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-lg">
                    {viewCandidate.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-[#ececec]">{viewCandidate.name}</DialogTitle>
                  <p className="text-sm text-[#6b6b6b]">{viewCandidate.role}</p>
                </div>
              </div>
            </DialogHeader>

            {/* Score */}
            <div className="flex items-center gap-3 bg-[#141414] rounded-lg p-3">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: scoreColor(viewCandidate.score) }}
              />
              <span className="text-lg font-bold font-mono text-[#ececec]">{viewCandidate.score}</span>
              <span className="text-sm text-[#6b6b6b]">AI Score</span>
            </div>

            {/* Contact Info */}
            <div className="space-y-2 bg-[#141414] rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-[#6b6b6b]" />
                <span className="text-[#ececec]">{viewCandidate.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-[#6b6b6b]" />
                <span className="text-[#ececec]">{viewCandidate.phone}</span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141414] rounded-lg p-3">
                <p className="text-[10px] text-[#6b6b6b] mb-1">Locatie</p>
                <p className="text-sm text-[#ececec]">{viewCandidate.location}</p>
              </div>
              <div className="bg-[#141414] rounded-lg p-3">
                <p className="text-[10px] text-[#6b6b6b] mb-1">Ervaring</p>
                <p className="text-sm text-[#ececec]">{viewCandidate.experience}</p>
              </div>
            </div>

            {/* Skills */}
            <div>
              <p className="text-xs font-medium text-[#8e8e8e] mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {viewCandidate.skills.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="text-xs border-[#2d2d2d] text-[#ececec] bg-[#0d0d0d]"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tags */}
            {viewCandidate.tags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#8e8e8e] mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewCandidate.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="text-xs border-[#10a37f]/30 text-[#10a37f] bg-[#10a37f]/10"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteCandidate !== null} onOpenChange={(open) => { if (!open) setDeleteCandidate(null) }}>
        {deleteCandidate && (
          <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#ececec]">Kandidaat verwijderen</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#8e8e8e]">
              Weet je zeker dat je <span className="text-[#ececec] font-medium">{deleteCandidate.name}</span> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteCandidate(null)}
                className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec]"
              >
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteConfirm}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Verwijderen
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-4 py-2.5 rounded-lg shadow-xl shadow-black/40 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  candidate: c,
  selected,
  onToggle,
  onViewProfile,
  onSendMessage,
  onEditTags,
  onDelete,
}: {
  candidate: Candidate
  selected: boolean
  onToggle: () => void
  onViewProfile: () => void
  onSendMessage: () => void
  onEditTags: () => void
  onDelete: () => void
}) {
  const maxSkills = 3
  const visibleSkills = c.skills.slice(0, maxSkills)
  const extraCount = c.skills.length - maxSkills

  return (
    <TableRow
      className={`border-[#2d2d2d] transition-colors ${
        selected ? "bg-[#10a37f]/5" : "hover:bg-[#252525]"
      }`}
    >
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="border-[#2d2d2d] data-[state=checked]:bg-[#10a37f] data-[state=checked]:border-[#10a37f]"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-xs">
              {c.avatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-[#ececec]">{c.name}</p>
            <p className="text-xs text-[#6b6b6b]">{c.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-[#ececec]">{c.role}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 flex-wrap">
          {visibleSkills.map((skill) => (
            <Badge
              key={skill}
              variant="outline"
              className="text-[10px] border-[#2d2d2d] text-[#8e8e8e] bg-[#0d0d0d]"
            >
              {skill}
            </Badge>
          ))}
          {extraCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] border-[#2d2d2d] text-[#6b6b6b] bg-transparent"
            >
              +{extraCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-[#8e8e8e]">{c.location}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: scoreColor(c.score) }}
          />
          <span className="text-sm font-mono text-[#ececec]">{c.score}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-[#8e8e8e]">{c.experience}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#6b6b6b] hover:text-[#ececec] hover:bg-[#2d2d2d]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#1e1e1e] border-[#2d2d2d]"
          >
            <DropdownMenuItem
              className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              onClick={onViewProfile}
            >
              <Eye className="h-4 w-4 mr-2" />
              Bekijk profiel
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              onClick={onSendMessage}
            >
              <Mail className="h-4 w-4 mr-2" />
              Stuur bericht
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              onClick={onEditTags}
            >
              <Tag className="h-4 w-4 mr-2" />
              Tags bewerken
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2d2d2d]" />
            <DropdownMenuItem
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
