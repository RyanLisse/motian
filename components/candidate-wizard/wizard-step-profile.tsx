"use client";

import { FileUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExperienceEntry } from "./experience-input";
import { ExperienceInput } from "./experience-input";
import { SkillsInput } from "./skills-input";

const ALLOWED_CV_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CV_SIZE_MB = 20;

export interface ProfileFormData {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  hourlyRate: string;
  availability: string;
  linkedinUrl: string;
  notes: string;
  skills: string[];
  experience: ExperienceEntry[];
}

const defaultFormData: ProfileFormData = {
  name: "",
  role: "",
  email: "",
  phone: "",
  location: "",
  hourlyRate: "",
  availability: "",
  linkedinUrl: "",
  notes: "",
  skills: [],
  experience: [],
};

interface WizardStepProfileProps {
  onSubmit: (candidateId: string) => void;
  onCancel: () => void;
}

export function WizardStepProfile({ onSubmit, onCancel }: WizardStepProfileProps) {
  const [formData, setFormData] = useState<ProfileFormData>(defaultFormData);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_CV_TYPES.includes(file.type)) {
      setError("Alleen PDF en Word (.docx) zijn toegestaan.");
      return;
    }
    if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
      setError(`Maximaal ${MAX_CV_SIZE_MB}MB.`);
      return;
    }
    setError("");
    setCvFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Naam is verplicht.");
      return;
    }
    if (!formData.role.trim()) {
      setError("Rol is verplicht.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setLoadingMessage("Kandidaat aanmaken...");
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        role: formData.role.trim() || undefined,
        source: "manual",
      };
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.location.trim()) payload.location = formData.location.trim();
      if (formData.hourlyRate.trim()) payload.hourlyRate = Number.parseInt(formData.hourlyRate, 10);
      if (formData.availability) payload.availability = formData.availability;
      if (formData.linkedinUrl.trim()) payload.linkedinUrl = formData.linkedinUrl.trim();
      if (formData.notes.trim()) payload.notes = formData.notes.trim();
      if (formData.skills.length) payload.skills = formData.skills;
      if (formData.experience.length)
        payload.experience = formData.experience.filter(
          (e) => e.title.trim() || e.company.trim() || e.duration.trim(),
        );

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

      if (cvFile) {
        setLoadingMessage("CV uploaden en verwerken...");
        const cvFormData = new FormData();
        cvFormData.append("cv", cvFile);
        const uploadRes = await fetch("/api/cv-upload", { method: "POST", body: cvFormData });
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
      }

      onSubmit(candidate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="wzp-name" className="text-sm font-medium text-foreground">
          Naam <span className="text-destructive">*</span>
        </label>
        <Input
          id="wzp-name"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          placeholder="Volledige naam"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-role" className="text-sm font-medium text-foreground">
          Rol / functietitel <span className="text-destructive">*</span>
        </label>
        <Input
          id="wzp-role"
          value={formData.role}
          onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
          placeholder="Bijv. Senior Java Developer"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="wzp-email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <Input
            id="wzp-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            placeholder="naam@voorbeeld.nl"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="wzp-phone" className="text-sm font-medium text-foreground">
            Telefoon
          </label>
          <Input
            id="wzp-phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+31 6 ..."
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-skills" className="text-sm font-medium text-foreground">
          Vaardigheden
        </label>
        <SkillsInput
          id="wzp-skills"
          value={formData.skills}
          onChange={(skills) => setFormData((p) => ({ ...p, skills }))}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-experience-title" className="text-sm font-medium text-foreground">
          Werkervaring
        </label>
        <ExperienceInput
          idPrefix="wzp-experience"
          value={formData.experience}
          onChange={(experience) => setFormData((p) => ({ ...p, experience }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="wzp-location" className="text-sm font-medium text-foreground">
            Locatie
          </label>
          <Input
            id="wzp-location"
            value={formData.location}
            onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
            placeholder="Bijv. Utrecht"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="wzp-rate" className="text-sm font-medium text-foreground">
            Uurtarief (&euro;)
          </label>
          <Input
            id="wzp-rate"
            type="number"
            min={0}
            value={formData.hourlyRate}
            onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))}
            placeholder="85"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-availability" className="text-sm font-medium text-foreground">
          Beschikbaarheid
        </label>
        <Select
          value={formData.availability}
          onValueChange={(v) => setFormData((p) => ({ ...p, availability: v }))}
        >
          <SelectTrigger id="wzp-availability" className="w-full">
            <SelectValue placeholder="Selecteer..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">Direct beschikbaar</SelectItem>
            <SelectItem value="1_maand">Binnen 1 maand</SelectItem>
            <SelectItem value="3_maanden">Binnen 3 maanden</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-linkedin" className="text-sm font-medium text-foreground">
          LinkedIn URL
        </label>
        <Input
          id="wzp-linkedin"
          type="url"
          value={formData.linkedinUrl}
          onChange={(e) => setFormData((p) => ({ ...p, linkedinUrl: e.target.value }))}
          placeholder="https://linkedin.com/in/..."
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="wzp-cv" className="text-sm font-medium text-foreground">
          CV bijvoegen
        </label>
        {!cvFile ? (
          <label
            htmlFor="wzp-cv"
            className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">
                Sleep een CV hierheen of klik om te selecteren
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF of Word &middot; Max {MAX_CV_SIZE_MB}MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              id="wzp-cv"
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
      <div className="space-y-1.5">
        <label htmlFor="wzp-notes" className="text-sm font-medium text-foreground">
          Notities
        </label>
        <Textarea
          id="wzp-notes"
          value={formData.notes}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Eventuele opmerkingen..."
          rows={3}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingMessage || "Opslaan..."}
            </>
          ) : (
            "Volgende: vacatures koppelen"
          )}
        </Button>
      </div>
    </form>
  );
}
