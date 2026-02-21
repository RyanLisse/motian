"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { FileUp, FileText, FileSpreadsheet, Eye, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CVUpload, type UploadResult } from "@/components/cv-upload"

interface CVEntry {
  id: string
  filename: string
  originalName: string
  kandidaat: string
  status: "Nieuw" | "Verwerkt" | "Geanalyseerd"
  aiScore: number | null
  uploadedAt: string
  path: string
  size: number
  type: string
}

const MOCK_CVS: CVEntry[] = [
  {
    id: "mock-1",
    filename: "1708934200000-jan_de_vries_cv.pdf",
    originalName: "jan_de_vries_cv.pdf",
    kandidaat: "Jan de Vries",
    status: "Geanalyseerd",
    aiScore: 87,
    uploadedAt: "2026-02-18T09:30:00.000Z",
    path: "#",
    size: 245760,
    type: "application/pdf",
  },
  {
    id: "mock-2",
    filename: "1708934100000-sophie_bakker_cv.docx",
    originalName: "sophie_bakker_cv.docx",
    kandidaat: "Sophie Bakker",
    status: "Verwerkt",
    aiScore: 72,
    uploadedAt: "2026-02-17T14:15:00.000Z",
    path: "#",
    size: 189440,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    id: "mock-3",
    filename: "1708934000000-pieter_van_den_berg_cv.pdf",
    originalName: "pieter_van_den_berg_cv.pdf",
    kandidaat: "Pieter van den Berg",
    status: "Nieuw",
    aiScore: null,
    uploadedAt: "2026-02-16T11:45:00.000Z",
    path: "#",
    size: 312320,
    type: "application/pdf",
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusBadge(status: CVEntry["status"]) {
  switch (status) {
    case "Nieuw":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          Nieuw
        </Badge>
      )
    case "Verwerkt":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">
          Verwerkt
        </Badge>
      )
    case "Geanalyseerd":
      return (
        <Badge className="bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/30 hover:bg-[#10a37f]/20">
          Geanalyseerd
        </Badge>
      )
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10a37f"
  if (score >= 60) return "#f59e0b"
  return "#ef4444"
}

export default function CVPage() {
  const [cvEntries, setCvEntries] = useState<CVEntry[]>(MOCK_CVS)
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

  const handleUploadComplete = useCallback(
    (result: UploadResult) => {
      const newEntry: CVEntry = {
        id: `upload-${Date.now()}`,
        filename: result.filename,
        originalName: result.originalName,
        kandidaat: result.originalName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        status: "Nieuw",
        aiScore: null,
        uploadedAt: result.uploadedAt,
        path: result.path,
        size: result.size,
        type: result.type,
      }
      setCvEntries((prev) => [newEntry, ...prev])
      showToast(`CV geüpload: ${result.originalName}`)
    },
    [showToast]
  )

  const removeEntry = (id: string) => {
    setCvEntries((prev) => prev.filter((e) => e.id !== id))
    showToast("CV verwijderd")
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#10a37f]/10 flex items-center justify-center">
            <FileUp className="h-5 w-5 text-[#10a37f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#ececec]">CV Beheer</h1>
            <p className="text-sm text-[#6b6b6b]">
              Upload en beheer kandidaat CV&apos;s
            </p>
          </div>
        </div>

        {/* Upload Component */}
        <CVUpload onUploadComplete={handleUploadComplete} />

        {/* CV Table */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2d2d2d]">
            <h2 className="text-sm font-medium text-[#ececec]">
              Alle CV&apos;s ({cvEntries.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                <TableHead className="text-[#8e8e8e] text-xs font-medium">Bestand</TableHead>
                <TableHead className="text-[#8e8e8e] text-xs font-medium">Kandidaat</TableHead>
                <TableHead className="text-[#8e8e8e] text-xs font-medium">Status</TableHead>
                <TableHead className="text-[#8e8e8e] text-xs font-medium">AI Score</TableHead>
                <TableHead className="text-[#8e8e8e] text-xs font-medium">Geüpload op</TableHead>
                <TableHead className="text-[#8e8e8e] text-xs font-medium w-24">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cvEntries.map((entry) => (
                <TableRow key={entry.id} className="border-[#2d2d2d] hover:bg-[#252525]">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.type === "application/pdf" ? (
                        <FileText className="h-4 w-4 text-red-400 shrink-0" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 text-blue-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-[#ececec] truncate max-w-[200px]">
                          {entry.originalName}
                        </p>
                        <p className="text-xs text-[#6b6b6b]">{formatFileSize(entry.size)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button className="text-sm text-[#10a37f] hover:underline">
                      {entry.kandidaat}
                    </button>
                  </TableCell>
                  <TableCell>{statusBadge(entry.status)}</TableCell>
                  <TableCell>
                    {entry.aiScore !== null ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: scoreColor(entry.aiScore) }}
                        />
                        <span className="text-sm font-mono text-[#ececec]">{entry.aiScore}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#6b6b6b]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-[#8e8e8e]">
                    {new Date(entry.uploadedAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#6b6b6b] hover:text-[#ececec] hover:bg-[#2d2d2d]"
                        asChild
                      >
                        <a
                          href={entry.path !== "#" ? entry.path : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#6b6b6b] hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-4 py-2.5 rounded-lg shadow-xl shadow-black/40 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}
