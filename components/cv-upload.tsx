"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, CheckCircle2, FileText, FileSpreadsheet, Loader2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface UploadResult {
  filename: string
  originalName: string
  size: number
  type: string
  uploadedAt: string
  path: string
}

interface CVUploadProps {
  onUploadComplete?: (result: UploadResult) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(type: string) {
  if (type === "application/pdf") {
    return <FileText className="h-4 w-4 text-red-400" />
  }
  return <FileSpreadsheet className="h-4 w-4 text-blue-400" />
}

export function CVUpload({ onUploadComplete }: CVUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUploaded, setLastUploaded] = useState<UploadResult | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setError(null)
    setLastUploaded(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/cv/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Upload mislukt")
        return
      }

      const result: UploadResult = {
        filename: data.filename,
        originalName: data.originalName,
        size: data.size,
        type: data.type,
        uploadedAt: data.uploadedAt,
        path: data.path,
      }

      setLastUploaded(result)
      setUploadedFiles((prev) => [result, ...prev])
      onUploadComplete?.(result)
    } catch {
      setError("Er is een fout opgetreden bij het uploaden.")
    } finally {
      setIsUploading(false)
    }
  }, [onUploadComplete])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    // Upload each file
    for (let i = 0; i < files.length; i++) {
      uploadFile(files[i])
    }
  }, [uploadFile])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ""
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const resetUpload = () => {
    setLastUploaded(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!isUploading ? handleClick : undefined}
        className={`relative w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-[#10a37f] bg-[#10a37f]/5"
            : error
            ? "border-red-500/50 bg-red-500/5"
            : lastUploaded
            ? "border-[#10a37f]/50 bg-[#10a37f]/5"
            : "border-[#2d2d2d] bg-[#141414] hover:border-[#6b6b6b]"
        }`}
        style={{ minHeight: "200px" }}
      >
        <div className="flex flex-col items-center justify-center h-full py-10 px-4">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 text-[#10a37f] animate-spin mb-3" />
              <p className="text-sm text-[#ececec] font-medium">Bezig met uploaden...</p>
            </>
          ) : lastUploaded ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-[#10a37f] mb-3" />
              <p className="text-sm text-[#10a37f] font-medium">Uploaden voltooid</p>
              <p className="text-xs text-[#8e8e8e] mt-1">
                {lastUploaded.originalName} ({formatFileSize(lastUploaded.size)})
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2d2d2d]"
                onClick={(e) => {
                  e.stopPropagation()
                  resetUpload()
                }}
              >
                Nog een CV uploaden
              </Button>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2d2d2d]"
                onClick={(e) => {
                  e.stopPropagation()
                  resetUpload()
                }}
              >
                Opnieuw proberen
              </Button>
            </>
          ) : isDragging ? (
            <>
              <Upload className="h-10 w-10 text-[#10a37f] mb-3" />
              <p className="text-sm text-[#10a37f] font-medium">Laat los om te uploaden</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-[#6b6b6b] mb-3" />
              <p className="text-sm text-[#ececec] font-medium">
                Sleep een CV hierheen of klik om te uploaden
              </p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                PDF of Word (.docx) &mdash; max 10MB
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2d2d2d]">
            <h3 className="text-sm font-medium text-[#ececec]">
              Geüploade bestanden ({uploadedFiles.length})
            </h3>
          </div>
          <div className="divide-y divide-[#2d2d2d]">
            {uploadedFiles.map((file, index) => (
              <div
                key={file.filename}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors"
              >
                {fileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#ececec] truncate">{file.originalName}</p>
                  <p className="text-xs text-[#6b6b6b]">
                    {formatFileSize(file.size)} &middot;{" "}
                    {new Date(file.uploadedAt).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2d2d2d]"
                    asChild
                  >
                    <a href={file.path} target="_blank" rel="noopener noreferrer">
                      Bekijk
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[#6b6b6b] hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
