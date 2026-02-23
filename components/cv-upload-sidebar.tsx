"use client";

import { AlertTriangle, Check, FileUp, Loader2, Upload, UserPlus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ParsedCV } from "@/src/schemas/candidate-intelligence";

interface DuplicateResult {
  exact: { id: string; name: string } | null;
  similar: { id: string; name: string; score: number }[];
}

export function CvUploadSidebar() {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedCV | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (f: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(f.type)) {
      setError("Alleen PDF en Word (.docx) bestanden zijn toegestaan");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("Bestand is te groot. Maximaal 20MB.");
      return;
    }

    setFile(f);
    setError(null);
    setUploading(true);
    setParsed(null);
    setDuplicates(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append("cv", f);
      const res = await fetch("/api/cv-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Upload mislukt");
      }
      const json = await res.json();
      setParsed(json.parsed);
      setFileUrl(json.fileUrl);
      setDuplicates(json.duplicates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) processFile(droppedFile);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) processFile(selected);
    },
    [processFile],
  );

  async function handleSave(existingCandidateId?: string) {
    if (!parsed || !fileUrl) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cv-upload/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed, fileUrl, existingCandidateId }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  function resetState() {
    setFile(null);
    setParsed(null);
    setFileUrl(null);
    setDuplicates(null);
    setSaved(false);
    setError(null);
    setUploading(false);
    setSaving(false);
  }

  const totalSkills = parsed ? parsed.skills.hard.length + parsed.skills.soft.length : 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <Upload className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            CV Uploaden
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <X className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success state */}
          {saved && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg p-3">
              <Check className="h-4 w-4 text-primary" />
              <p className="text-sm text-primary font-medium">Kandidaat opgeslagen!</p>
            </div>
          )}

          {/* Upload zone - show when no file is processing */}
          {!uploading && !parsed && !saved && (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors block ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <FileUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground block">Sleep een CV hierheen</span>
              <span className="text-xs text-muted-foreground mt-1 block">
                of klik om te selecteren
              </span>
              <span className="text-xs text-muted-foreground mt-2 block">
                PDF of Word (.docx) &middot; Max 20MB
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}

          {/* Uploading state */}
          {uploading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">CV wordt verwerkt...</p>
              {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            </div>
          )}

          {/* Parsed profile preview */}
          {parsed && !saved && (
            <div className="flex flex-col gap-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold text-foreground">{parsed.name}</h3>
                <p className="text-sm text-muted-foreground">{parsed.role}</p>
                {parsed.location && (
                  <p className="text-xs text-muted-foreground mt-1">{parsed.location}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">{parsed.summary}</p>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{totalSkills} vaardigheden</span>
                  <span>{parsed.experience.length} ervaringen</span>
                  <span>{parsed.education.length} opleidingen</span>
                </div>
              </div>

              {/* Deduplication alert */}
              {duplicates?.exact && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <p className="text-sm font-medium text-foreground">Kandidaat gevonden</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {duplicates.exact.name} bestaat al in het systeem.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(duplicates.exact?.id)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Samenvoegen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave()}
                      disabled={saving}
                    >
                      Nieuw aanmaken
                    </Button>
                  </div>
                </div>
              )}

              {/* Similar candidates */}
              {duplicates?.similar && duplicates.similar.length > 0 && !duplicates.exact && (
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Vergelijkbare kandidaten
                  </p>
                  {duplicates.similar.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs text-muted-foreground py-1"
                    >
                      <span>{s.name}</span>
                      <span>{Math.round(s.score * 100)}% match</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Save button (when no exact duplicate) */}
              {!duplicates?.exact && (
                <Button onClick={() => handleSave()} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Opslaan
                </Button>
              )}
            </div>
          )}

          {/* Upload another button after save */}
          {saved && (
            <Button variant="outline" onClick={resetState} className="w-full">
              Nog een CV uploaden
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
