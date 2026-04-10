"use client";

import { useEffect, useState } from "react";
import { useDataMutationNotifier } from "@/components/data-refresh-listener";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { appendOptimisticNote } from "@/src/lib/mobile-optimistic";

export function CandidateNotes({
  candidateId,
  initialNotes,
}: {
  candidateId: string;
  initialNotes: string | null;
}) {
  const notifyDataMutation = useDataMutationNotifier();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  async function handleAddNote() {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return;

    const previousNotes = notes;
    setError(null);
    setSaving(true);
    setNotes(appendOptimisticNote(notes, trimmedDraft));
    setDraft("");

    try {
      const res = await fetch(`/api/kandidaten/${candidateId}/notities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmedDraft }),
      });

      const body = (await res.json().catch(() => null)) as {
        data?: { notes?: string | null };
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Notitie opslaan mislukt");
      }

      setNotes(body?.data?.notes ?? appendOptimisticNote(previousNotes, trimmedDraft));
      notifyDataMutation(["candidates"]);
    } catch (saveError) {
      setNotes(previousNotes);
      setDraft(trimmedDraft);
      setError(saveError instanceof Error ? saveError.message : "Notitie opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Notities</h3>
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {notes ? (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
            {notes}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground/60">
            Nog geen notities — voeg een notitie toe
          </p>
        )}

        <div className="border-t border-border pt-4 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Schrijf een notitie…"
            rows={2}
            className="text-sm resize-none"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleAddNote();
              }
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddNote} disabled={saving || !draft.trim()}>
              {saving ? "Opslaan…" : "Notitie toevoegen"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
