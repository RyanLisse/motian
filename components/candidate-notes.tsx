"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CandidateNotes({
  candidateId,
  initialNotes,
}: {
  candidateId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function handleAddNote() {
    if (!draft.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/kandidaten/${candidateId}/notities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft.trim() }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setNotes(data.notes);
        setDraft("");
        startTransition(() => router.refresh());
      }
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
