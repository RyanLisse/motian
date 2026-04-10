"use client";

import { Loader2, MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataMutationNotifier } from "@/components/data-refresh-listener";
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
import { Textarea } from "@/components/ui/textarea";

export function ApplicationFeedbackEditor({
  applicationId,
  initialNotes,
  onNotesChange,
}: {
  applicationId: string;
  initialNotes?: string | null;
  onNotesChange?: (notes: string | null) => void;
}) {
  const notifyDataMutation = useDataMutationNotifier();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
  }, [initialNotes]);

  const hasNotes = (initialNotes ?? "").trim().length > 0;

  const handleSave = async () => {
    const previousNotes = initialNotes ?? "";
    const nextNotes = notes.trim();

    setSaving(true);
    setError(null);
    onNotesChange?.(nextNotes || null);

    try {
      const response = await fetch(`/api/sollicitaties/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: nextNotes }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Recruiterfeedback opslaan mislukt");
      }

      notifyDataMutation(["pipeline"]);
      setOpen(false);
    } catch (saveError) {
      onNotesChange?.(previousNotes || null);
      setError(
        saveError instanceof Error ? saveError.message : "Recruiterfeedback opslaan mislukt",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {hasNotes ? "Feedback bewerken" : "Feedback toevoegen"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recruiterfeedback</DialogTitle>
          <DialogDescription>
            Leg vast wat besproken is, wat de recruiter wil opvolgen en welke context de volgende
            fase nodig heeft.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Bijv. Sterke intake, wil extra beschikbaarheid toetsen, referenties nog opvragen…"
          className="min-h-40"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuleren
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opslaan...
              </>
            ) : (
              "Feedback opslaan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
