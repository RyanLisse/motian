"use client";

import { Loader2, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

export function InterviewFeedbackEditor({
  interviewId,
  initialFeedback,
  initialRating,
}: {
  interviewId: string;
  initialFeedback?: string | null;
  initialRating?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [rating, setRating] = useState(initialRating ? String(initialRating) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const parsedRating = rating.trim() ? Number(rating) : undefined;

    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback,
          rating: Number.isFinite(parsedRating) ? parsedRating : undefined,
          status: "completed",
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Interviewfeedback opslaan mislukt");
      }

      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Interviewfeedback opslaan mislukt",
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
          {initialFeedback ? "Feedback bewerken" : "Feedback toevoegen"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Interviewfeedback</DialogTitle>
          <DialogDescription>
            Leg recruiterfeedback vast zodat pipeline-opvolging en volgende stappen direct helder
            zijn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor={`rating-${interviewId}`} className="text-sm font-medium text-foreground">
            Score (1–5)
          </label>
          <Input
            id={`rating-${interviewId}`}
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            placeholder="Bijv. 4"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`feedback-${interviewId}`}
            className="text-sm font-medium text-foreground"
          >
            Feedback
          </label>
          <Textarea
            id={`feedback-${interviewId}`}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Bijv. Sterke communicatie, technisch nog één verdiepingsslag nodig."
            className="min-h-40"
          />
        </div>

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
