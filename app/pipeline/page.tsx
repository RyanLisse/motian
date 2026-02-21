"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  candidates as allCandidates,
  pipelineStages,
  positionsList,
  type Candidate,
} from "@/lib/data"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  GripVertical,
  Plus,
  Mail,
  Phone,
  Calendar,
  MoreHorizontal,
  Eye,
  Trash2,
  ArrowRight,
  Clock,
} from "lucide-react"

type StageId = "new" | "screening" | "interview" | "offer" | "hired"

const STATUS_TO_STAGE: Record<Candidate["status"], StageId> = {
  new: "new",
  screening: "screening",
  interview: "interview",
  offer: "offer",
  hired: "hired",
  rejected: "new",
}

function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e"
  if (score >= 80) return "#10a37f"
  if (score >= 70) return "#f59e0b"
  return "#ef4444"
}

export default function PipelinePage() {
  const [positionFilter, setPositionFilter] = useState<string>("all")
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  )
  const [dialogOpen, setDialogOpen] = useState(false)

  // Toast state
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Add candidate dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newRole, setNewRole] = useState("")
  const [newEmail, setNewEmail] = useState("")

  // Full profile view state
  const [fullProfileCandidate, setFullProfileCandidate] = useState<Candidate | null>(null)

  // Build initial pipeline from candidate statuses
  const [pipeline, setPipeline] = useState<Record<StageId, Candidate[]>>(
    () => {
      const map: Record<StageId, Candidate[]> = {
        new: [],
        screening: [],
        interview: [],
        offer: [],
        hired: [],
      }
      for (const c of allCandidates) {
        const stage = STATUS_TO_STAGE[c.status]
        map[stage].push(c)
      }
      return map
    }
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // All candidates flat for lookup
  const allInPipeline = useMemo(
    () => Object.values(pipeline).flat(),
    [pipeline]
  )

  const activeCandidate = activeId
    ? allInPipeline.find((c) => c.id === activeId) ?? null
    : null

  function findContainer(id: string): StageId | null {
    // Check if id is a stage
    if (id in pipeline) return id as StageId
    // Find which stage contains this candidate
    for (const [stageId, candidates] of Object.entries(pipeline)) {
      if (candidates.some((c) => c.id === id)) return stageId as StageId
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string)

    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return

    setPipeline((prev) => {
      const activeItems = [...prev[activeContainer]]
      const overItems = [...prev[overContainer]]

      const activeIndex = activeItems.findIndex(
        (c) => c.id === (active.id as string)
      )
      if (activeIndex === -1) return prev

      const [movedItem] = activeItems.splice(activeIndex, 1)

      // Find insert position
      const overIndex = overItems.findIndex(
        (c) => c.id === (over.id as string)
      )
      if (overIndex === -1) {
        overItems.push(movedItem)
      } else {
        overItems.splice(overIndex, 0, movedItem)
      }

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string)

    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      setPipeline((prev) => {
        const items = [...prev[activeContainer]]
        const oldIndex = items.findIndex(
          (c) => c.id === (active.id as string)
        )
        const newIndex = items.findIndex((c) => c.id === (over.id as string))
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const [item] = items.splice(oldIndex, 1)
          items.splice(newIndex, 0, item)
        }
        return { ...prev, [activeContainer]: items }
      })
    }
  }

  function moveCandidate(candidateId: string, toStage: StageId) {
    setPipeline((prev) => {
      const fromStage = findContainer(candidateId)
      if (!fromStage || fromStage === toStage) return prev

      const fromItems = [...prev[fromStage]]
      const toItems = [...prev[toStage]]
      const idx = fromItems.findIndex((c) => c.id === candidateId)
      if (idx === -1) return prev

      const [item] = fromItems.splice(idx, 1)
      toItems.push(item)

      return { ...prev, [fromStage]: fromItems, [toStage]: toItems }
    })
    setDialogOpen(false)
  }

  function openCandidateDialog(c: Candidate) {
    setSelectedCandidate(c)
    setDialogOpen(true)
  }

  // Remove candidate from pipeline
  function removeCandidate(candidateId: string) {
    setPipeline((prev) => {
      const next = { ...prev }
      for (const stageId of Object.keys(next) as StageId[]) {
        next[stageId] = next[stageId].filter((c) => c.id !== candidateId)
      }
      return next
    })
  }

  // Add new candidate
  function handleAddCandidate() {
    if (!newName.trim() || !newRole.trim() || !newEmail.trim()) return

    const newCandidate: Candidate = {
      id: `c-new-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole.trim(),
      avatar: newName.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      score: Math.floor(Math.random() * 30) + 60,
      skills: [],
      experience: "Onbekend",
      status: "new",
      appliedDate: new Date().toISOString().split("T")[0],
      source: "Handmatig",
      resumeQuality: 0,
      skillMatch: 0,
      relevance: 0,
      location: "Onbekend",
      phone: "-",
      tags: [],
    }

    setPipeline((prev) => ({
      ...prev,
      new: [...prev.new, newCandidate],
    }))

    setNewName("")
    setNewRole("")
    setNewEmail("")
    setAddDialogOpen(false)
    showToast(`${newCandidate.name} toegevoegd aan pipeline`)
  }

  // Stage counts
  const stageCounts = pipelineStages.map((s) => ({
    ...s,
    count: pipeline[s.id as StageId]?.length ?? 0,
  }))

  const totalInPipeline = allInPipeline.length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#ececec]">
              Recruitment Pipeline
            </h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              Sleep kandidaten tussen fases
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-56 bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec]">
                <SelectValue placeholder="Alle posities" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                <SelectItem
                  value="all"
                  className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                >
                  Alle posities
                </SelectItem>
                {positionsList.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
                  >
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="bg-[#10a37f] text-white hover:bg-[#0e8c6b]"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Kandidaat toevoegen
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-4">
            {pipelineStages.map((stage) => {
              const stageId = stage.id as StageId
              const items = pipeline[stageId] ?? []
              return (
                <KanbanColumn
                  key={stageId}
                  stageId={stageId}
                  label={stage.name}
                  color={stage.color}
                  count={items.length}
                  candidates={items}
                  onCardClick={openCandidateDialog}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeCandidate ? (
              <CandidateCard
                candidate={activeCandidate}
                isDragOverlay
                onClick={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Quick Stats Bar */}
        <div className="flex items-center gap-6 bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl px-5 py-3">
          {stageCounts.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-[#8e8e8e]">{s.name}</span>
              <span className="text-xs font-mono text-[#ececec]">
                {s.count}
              </span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-[#6b6b6b]">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Gem. pipeline tijd: 18 dagen | {totalInPipeline} totaal
            </span>
          </div>
        </div>

        {/* Candidate Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {selectedCandidate && (
            <CandidateDialog
              candidate={selectedCandidate}
              onMove={moveCandidate}
              pipeline={pipeline}
              onShowFullProfile={(c) => {
                setDialogOpen(false)
                setFullProfileCandidate(c)
              }}
              onSendMessage={(c) => {
                showToast(`Bericht venster geopend voor ${c.name}`)
              }}
              onPlanInterview={(c) => {
                showToast(`Interview ingepland voor ${c.name}`)
              }}
              onReject={(c) => {
                removeCandidate(c.id)
                setDialogOpen(false)
                showToast(`Kandidaat afgewezen`)
              }}
            />
          )}
        </Dialog>

        {/* Add Candidate Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#ececec]">Kandidaat toevoegen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#8e8e8e] mb-1.5 block">Naam</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Volledige naam"
                  className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/50 focus-visible:border-[#10a37f]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8e8e8e] mb-1.5 block">Rol</label>
                <Input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Bijv. Senior Developer"
                  className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/50 focus-visible:border-[#10a37f]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8e8e8e] mb-1.5 block">Email</label>
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@voorbeeld.nl"
                  type="email"
                  className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/50 focus-visible:border-[#10a37f]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(false)}
                className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec]"
              >
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={handleAddCandidate}
                disabled={!newName.trim() || !newRole.trim() || !newEmail.trim()}
                className="bg-[#10a37f] text-white hover:bg-[#0e8c6b] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Toevoegen
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full Profile Dialog */}
        <Dialog open={fullProfileCandidate !== null} onOpenChange={(open) => { if (!open) setFullProfileCandidate(null) }}>
          {fullProfileCandidate && (
            <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-lg">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-lg">
                      {fullProfileCandidate.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-[#ececec]">{fullProfileCandidate.name}</DialogTitle>
                    <p className="text-sm text-[#6b6b6b]">{fullProfileCandidate.role}</p>
                  </div>
                </div>
              </DialogHeader>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#141414] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#ececec]">{fullProfileCandidate.score}</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-0.5">AI Score</p>
                </div>
                <div className="bg-[#141414] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#ececec]">{fullProfileCandidate.skillMatch}</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-0.5">Skill Match</p>
                </div>
                <div className="bg-[#141414] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#ececec]">{fullProfileCandidate.relevance}</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-0.5">Relevantie</p>
                </div>
                <div className="bg-[#141414] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#ececec]">{fullProfileCandidate.resumeQuality}</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-0.5">CV Kwaliteit</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 bg-[#141414] rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-[#6b6b6b]" />
                  <span className="text-[#ececec]">{fullProfileCandidate.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-[#6b6b6b]" />
                  <span className="text-[#ececec]">{fullProfileCandidate.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-[#6b6b6b]" />
                  <span className="text-[#8e8e8e]">Gesolliciteerd: {fullProfileCandidate.appliedDate}</span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#141414] rounded-lg p-3">
                  <p className="text-[10px] text-[#6b6b6b] mb-1">Locatie</p>
                  <p className="text-sm text-[#ececec]">{fullProfileCandidate.location}</p>
                </div>
                <div className="bg-[#141414] rounded-lg p-3">
                  <p className="text-[10px] text-[#6b6b6b] mb-1">Ervaring</p>
                  <p className="text-sm text-[#ececec]">{fullProfileCandidate.experience}</p>
                </div>
                <div className="bg-[#141414] rounded-lg p-3">
                  <p className="text-[10px] text-[#6b6b6b] mb-1">Bron</p>
                  <p className="text-sm text-[#ececec]">{fullProfileCandidate.source}</p>
                </div>
              </div>

              {/* All Skills */}
              <div>
                <p className="text-xs font-medium text-[#8e8e8e] mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {fullProfileCandidate.skills.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-xs border-[#2d2d2d] text-[#ececec] bg-[#0d0d0d]"
                    >
                      {s}
                    </Badge>
                  ))}
                  {fullProfileCandidate.skills.length === 0 && (
                    <span className="text-xs text-[#6b6b6b]">Geen skills opgegeven</span>
                  )}
                </div>
              </div>

              {/* Tags */}
              {fullProfileCandidate.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#8e8e8e] mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fullProfileCandidate.tags.map((t) => (
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
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-4 py-2.5 rounded-lg shadow-xl shadow-black/40 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}

// -- Kanban Column --

function KanbanColumn({
  stageId,
  label,
  color,
  count,
  candidates,
  onCardClick,
}: {
  stageId: StageId
  label: string
  color: string
  count: number
  candidates: Candidate[]
  onCardClick: (c: Candidate) => void
}) {
  const { setNodeRef } = useSortable({
    id: stageId,
    data: { type: "container" },
  })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col bg-[#141414] rounded-xl border border-[#2d2d2d] min-h-[400px]"
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[#2d2d2d]">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-[#ececec]">{label}</span>
        <Badge
          variant="outline"
          className="ml-auto text-[10px] border-[#2d2d2d] text-[#8e8e8e] bg-transparent"
        >
          {count}
        </Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext
          items={candidates.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {candidates.map((c) => (
            <SortableCard
              key={c.id}
              candidate={c}
              onClick={() => onCardClick(c)}
            />
          ))}
        </SortableContext>

        {candidates.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-[#6b6b6b] border border-dashed border-[#2d2d2d] rounded-lg">
            Sleep hierheen
          </div>
        )}
      </div>
    </div>
  )
}

// -- Sortable Card Wrapper --

function SortableCard({
  candidate,
  onClick,
}: {
  candidate: Candidate
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <CandidateCard
        candidate={candidate}
        onClick={onClick}
        dragListeners={listeners}
      />
    </div>
  )
}

// -- Candidate Card --

function CandidateCard({
  candidate: c,
  isDragOverlay,
  onClick,
  dragListeners,
}: {
  candidate: Candidate
  isDragOverlay?: boolean
  onClick: () => void
  dragListeners?: Record<string, unknown>
}) {
  return (
    <div
      className={`bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-3 cursor-pointer hover:border-[#10a37f]/40 transition-colors ${
        isDragOverlay ? "shadow-xl shadow-black/40 rotate-2" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Grip Handle */}
        <div
          className="mt-0.5 text-[#6b6b6b] hover:text-[#8e8e8e] cursor-grab active:cursor-grabbing"
          {...dragListeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + Avatar */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-[10px]">
                {c.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#ececec] truncate">
                {c.name}
              </p>
            </div>
          </div>

          {/* Role */}
          <p className="text-xs text-[#6b6b6b] mt-1 truncate">{c.role}</p>

          {/* AI Score */}
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: scoreColor(c.score) }}
            />
            <span className="text-xs font-mono text-[#8e8e8e]">
              AI Score: {c.score}
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mt-2">
            {c.skills.slice(0, 2).map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-[9px] border-[#2d2d2d] text-[#8e8e8e] bg-[#0d0d0d] px-1.5 py-0"
              >
                {s}
              </Badge>
            ))}
            {c.skills.length > 2 && (
              <Badge
                variant="outline"
                className="text-[9px] border-[#2d2d2d] text-[#6b6b6b] bg-transparent px-1.5 py-0"
              >
                +{c.skills.length - 2}
              </Badge>
            )}
          </div>

          {/* Source + Date */}
          <div className="flex items-center justify-between mt-2 text-[10px] text-[#6b6b6b]">
            <span>{c.source}</span>
            <span>{c.appliedDate}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// -- Candidate Dialog --

function CandidateDialog({
  candidate: c,
  onMove,
  pipeline,
  onShowFullProfile,
  onSendMessage,
  onPlanInterview,
  onReject,
}: {
  candidate: Candidate
  onMove: (candidateId: string, toStage: StageId) => void
  pipeline: Record<StageId, Candidate[]>
  onShowFullProfile: (c: Candidate) => void
  onSendMessage: (c: Candidate) => void
  onPlanInterview: (c: Candidate) => void
  onReject: (c: Candidate) => void
}) {
  // Find current stage
  let currentStage: StageId = "new"
  for (const [stageId, candidates] of Object.entries(pipeline)) {
    if (candidates.some((cand) => cand.id === c.id)) {
      currentStage = stageId as StageId
      break
    }
  }

  const stageOrder: StageId[] = [
    "new",
    "screening",
    "interview",
    "offer",
    "hired",
  ]
  const currentIndex = stageOrder.indexOf(currentStage)
  const nextStage =
    currentIndex < stageOrder.length - 1
      ? stageOrder[currentIndex + 1]
      : null
  const prevStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : null

  const stageLabel = (id: StageId) =>
    pipelineStages.find((s) => s.id === id)?.name ?? id

  return (
    <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-[#2d2d2d] text-[#ececec] text-lg">
              {c.avatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle className="text-[#ececec]">{c.name}</DialogTitle>
            <p className="text-sm text-[#6b6b6b]">{c.role}</p>
          </div>
        </div>
      </DialogHeader>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Skill Match" value={c.skillMatch} />
        <MetricCard label="Relevantie" value={c.relevance} />
        <MetricCard label="CV Kwaliteit" value={c.resumeQuality} />
      </div>

      {/* Contact Info */}
      <div className="space-y-2 bg-[#141414] rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-[#6b6b6b]" />
          <span className="text-[#ececec]">{c.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-[#6b6b6b]" />
          <span className="text-[#ececec]">{c.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-[#6b6b6b]" />
          <span className="text-[#8e8e8e]">
            Gesolliciteerd: {c.appliedDate}
          </span>
        </div>
      </div>

      {/* Skills */}
      <div>
        <p className="text-xs font-medium text-[#8e8e8e] mb-2">Skills</p>
        <div className="flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
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

      {/* Stage Move Buttons */}
      <div className="flex items-center gap-2">
        {prevStage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(c.id, prevStage)}
            className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec] flex-1"
          >
            <ArrowRight className="h-3.5 w-3.5 mr-1.5 rotate-180" />
            {stageLabel(prevStage)}
          </Button>
        )}
        {nextStage && (
          <Button
            size="sm"
            onClick={() => onMove(c.id, nextStage)}
            className="bg-[#10a37f] text-white hover:bg-[#0e8c6b] flex-1"
          >
            {stageLabel(nextStage)}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec]"
          onClick={() => onShowFullProfile(c)}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Volledig profiel
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec]"
          onClick={() => onSendMessage(c)}
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Bericht
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2d2d2d] bg-[#0d0d0d] text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-[#ececec] ml-auto"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#1e1e1e] border-[#2d2d2d]"
          >
            <DropdownMenuItem
              className="text-[#ececec] focus:bg-[#2d2d2d] focus:text-[#ececec]"
              onClick={() => onPlanInterview(c)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Interview plannen
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => onReject(c)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Afwijzen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DialogContent>
  )
}

// -- Metric Card --

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#141414] rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-[#ececec]">{value}</p>
      <p className="text-[10px] text-[#6b6b6b] mt-0.5">{label}</p>
    </div>
  )
}
