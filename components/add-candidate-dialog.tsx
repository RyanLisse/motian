"use client";

import { FileUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ALLOWED_CV_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CV_SIZE_MB = 20;

export function AddCandidateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_CV_TYPES.includes(file.type)) {
      setError("Alleen PDF en Word (.docx) bestanden zijn toegestaan.");
      return;
    }
    if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
      setError(`Bestand te groot. Maximaal ${MAX_CV_SIZE_MB}MB.`);
      return;
    }

    setError("");
    setCvFile(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const name = data.get("name") as string;
    if (!name.trim()) {
      setError("Naam is verplicht.");
      setLoading(false);
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      source: "manual",
    };

    const email = (data.get("email") as string)?.trim();
    if (email) payload.email = email;

    const phone = (data.get("phone") as string)?.trim();
    if (phone) payload.phone = phone;

    const role = (data.get("role") as string)?.trim();
    if (role) payload.role = role;

    const location = (data.get("location") as string)?.trim();
    if (location) payload.location = location;

    const hourlyRate = (data.get("hourlyRate") as string)?.trim();
    if (hourlyRate) payload.hourlyRate = Number.parseInt(hourlyRate, 10);

    const availability = (data.get("availability") as string)?.trim();
    if (availability) payload.availability = availability;

    const linkedinUrl = (data.get("linkedinUrl") as string)?.trim();
    if (linkedinUrl) payload.linkedinUrl = linkedinUrl;

    const notes = (data.get("notes") as string)?.trim();
    if (notes) payload.notes = notes;

    try {
      // Phase 1: Create candidate
      setLoadingMessage("Kandidaat aanmaken...");
      const res = await fetch("/api/kandidaten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Fout: ${res.status}`);
      }

      const { data: candidate } = await res.json();

      // Phase 2: Upload CV if attached
      if (cvFile) {
        setLoadingMessage("CV uploaden en verwerken...");
        const cvFormData = new FormData();
        cvFormData.append("cv", cvFile);

        const uploadRes = await fetch("/api/cv-upload", {
          method: "POST",
          body: cvFormData,
        });

        if (uploadRes.ok) {
          const { parsed, fileUrl } = await uploadRes.json();

          setLoadingMessage("CV koppelen aan kandidaat...");
          await fetch("/api/cv-upload/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parsed,
              fileUrl,
              existingCandidateId: candidate.id,
            }),
          });
        }
        // CV upload failure is non-fatal — candidate is already created
      }

      setOpen(false);
      setCvFile(null);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Kandidaat toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kandidaat toevoegen</DialogTitle>
          <DialogDescription>
            Voeg handmatig een nieuwe kandidaat toe aan de talent pool.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Naam */}
          <div className="space-y-1.5">
            <label htmlFor="ac-name" className="text-sm font-medium text-foreground">
              Naam <span className="text-destructive">*</span>
            </label>
            <Input id="ac-name" name="name" required placeholder="Volledige naam" />
          </div>

          {/* Email + Telefoon row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ac-email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <Input id="ac-email" name="email" type="email" placeholder="naam@voorbeeld.nl" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ac-phone" className="text-sm font-medium text-foreground">
                Telefoon
              </label>
              <Input id="ac-phone" name="phone" type="tel" placeholder="+31 6 ..." />
            </div>
          </div>

          {/* Rol */}
          <div className="space-y-1.5">
            <label htmlFor="ac-role" className="text-sm font-medium text-foreground">
              Rol / functietitel
            </label>
            <Input id="ac-role" name="role" placeholder="Bijv. Senior Java Developer" />
          </div>

          {/* Locatie + Uurtarief row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ac-location" className="text-sm font-medium text-foreground">
                Locatie
              </label>
              <Input id="ac-location" name="location" placeholder="Bijv. Utrecht" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ac-rate" className="text-sm font-medium text-foreground">
                Uurtarief (&euro;)
              </label>
              <Input id="ac-rate" name="hourlyRate" type="number" min={0} placeholder="85" />
            </div>
          </div>

          {/* Beschikbaarheid */}
          <div className="space-y-1.5">
            <label htmlFor="ac-availability" className="text-sm font-medium text-foreground">
              Beschikbaarheid
            </label>
            <Select name="availability">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecteer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct beschikbaar</SelectItem>
                <SelectItem value="1_maand">Binnen 1 maand</SelectItem>
                <SelectItem value="3_maanden">Binnen 3 maanden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-1.5">
            <label htmlFor="ac-linkedin" className="text-sm font-medium text-foreground">
              LinkedIn URL
            </label>
            <Input
              id="ac-linkedin"
              name="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          {/* CV Upload */}
          <div className="space-y-1.5">
            <label htmlFor="ac-cv" className="text-sm font-medium text-foreground">
              CV bijvoegen
            </label>
            {!cvFile ? (
              <label
                htmlFor="ac-cv"
                className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors"
              >
                <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Sleep een CV hierheen of klik om te selecteren
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PDF of Word (.docx) &middot; Max {MAX_CV_SIZE_MB}MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  id="ac-cv"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 border border-border rounded-lg p-3 bg-muted/30">
                <FileUp className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{cvFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCvFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Notities */}
          <div className="space-y-1.5">
            <label htmlFor="ac-notes" className="text-sm font-medium text-foreground">
              Notities
            </label>
            <Textarea id="ac-notes" name="notes" placeholder="Eventuele opmerkingen..." rows={3} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingMessage || "Opslaan..."}
                </>
              ) : (
                "Opslaan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
