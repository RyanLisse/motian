"use client";

import { Copy, FileText, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";
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

type CommercialCvResponse = {
  data: {
    title: string;
    body: string;
    format: "markdown";
  };
};

type ChannelOfferResponse = {
  data: {
    status: "not_configured";
    message: string;
    handoff: {
      candidateId: string;
      name: string;
      role: string | null;
      headline: string | null;
      channelHint: string | null;
      notes: string | null;
    };
    checklist: string[];
  };
};

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function CandidateOfferActions({
  candidateId,
  defaultJobId,
}: {
  candidateId: string;
  defaultJobId?: string;
}) {
  const [cvOpen, setCvOpen] = useState(false);
  const [cvDraft, setCvDraft] = useState("");
  const [cvTitle, setCvTitle] = useState("Commercieel CV");
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvCopyFeedback, setCvCopyFeedback] = useState<string | null>(null);

  const [handoffOpen, setHandoffOpen] = useState(false);
  const [channelHint, setChannelHint] = useState("");
  const [notes, setNotes] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffData, setHandoffData] = useState<ChannelOfferResponse["data"] | null>(null);
  const [handoffCopyFeedback, setHandoffCopyFeedback] = useState<string | null>(null);

  const handoffText = useMemo(() => {
    if (!handoffData) return "";

    const lines = [
      `Kanaal-aanbod voor ${handoffData.handoff.name}`,
      `Kandidaat-ID: ${handoffData.handoff.candidateId}`,
      `Rol: ${handoffData.handoff.role ?? "—"}`,
      `Kanaal: ${handoffData.handoff.channelHint ?? "Nog niet opgegeven"}`,
      `Headline: ${handoffData.handoff.headline ?? "—"}`,
      `Notities: ${handoffData.handoff.notes ?? "—"}`,
      "",
      "Checklist:",
      ...handoffData.checklist.map((item) => `- ${item}`),
    ];

    return lines.join("\n");
  }, [handoffData]);

  const loadCommercialCv = async () => {
    setCvLoading(true);
    setCvError(null);

    try {
      const response = await fetch("/api/commercieel-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          ...(defaultJobId ? { jobId: defaultJobId } : {}),
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | CommercialCvResponse
        | { error?: string }
        | null;

      if (!response.ok || !body || !("data" in body)) {
        const message =
          body && "error" in body && typeof body.error === "string" ? body.error : null;
        throw new Error(message ?? "Commercieel CV genereren mislukt");
      }

      setCvTitle(body.data.title);
      setCvDraft(body.data.body);
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "Commercieel CV genereren mislukt");
    } finally {
      setCvLoading(false);
    }
  };

  const loadChannelHandoff = async () => {
    setHandoffLoading(true);
    setHandoffError(null);

    try {
      const response = await fetch(`/api/kandidaten/${candidateId}/kanaal-aanbod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelHint: channelHint.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | ChannelOfferResponse
        | { error?: string }
        | null;
      if (!response.ok || !body || !("data" in body)) {
        const message =
          body && "error" in body && typeof body.error === "string" ? body.error : null;
        throw new Error(message ?? "Kanaal-aanbod voorbereiden mislukt");
      }

      setHandoffData(body.data);
    } catch (error) {
      setHandoffError(
        error instanceof Error ? error.message : "Kanaal-aanbod voorbereiden mislukt",
      );
    } finally {
      setHandoffLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog
        open={cvOpen}
        onOpenChange={(open) => {
          setCvOpen(open);
          if (open && cvDraft.length === 0 && !cvLoading) {
            void loadCommercialCv();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Commercieel CV
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{cvTitle}</DialogTitle>
            <DialogDescription>
              Werk het concept bij en kopieer het daarna voor verzending of verdere uitwerking.
            </DialogDescription>
          </DialogHeader>

          {cvError ? <p className="text-sm text-destructive">{cvError}</p> : null}

          <Textarea
            value={cvDraft}
            onChange={(event) => setCvDraft(event.target.value)}
            className="min-h-[360px] font-mono text-xs"
            placeholder={cvLoading ? "Concept wordt geladen..." : "Nog geen concept beschikbaar"}
          />

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {cvCopyFeedback ?? "Markdown-concept, direct bewerkbaar."}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadCommercialCv()}
                disabled={cvLoading}
              >
                {cvLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vernieuw concept"}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await copyText(cvDraft);
                  setCvCopyFeedback("Concept gekopieerd");
                  window.setTimeout(() => setCvCopyFeedback(null), 2000);
                }}
                disabled={!cvDraft}
              >
                <Copy className="h-4 w-4" />
                Kopieer concept
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Send className="h-4 w-4" />
            Kanaal-aanbod
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kanaal-aanbod voorbereiden</DialogTitle>
            <DialogDescription>
              Maak een gecontroleerde recruiter-handoff voor externe kanalen of bronnen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="channel-hint" className="text-sm font-medium text-foreground">
                Kanaal of bron
              </label>
              <Input
                id="channel-hint"
                value={channelHint}
                onChange={(event) => setChannelHint(event.target.value)}
                placeholder="Bijv. LinkedIn, Striive, MiPublic"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="channel-notes" className="text-sm font-medium text-foreground">
                Recruiternotities
              </label>
              <Textarea
                id="channel-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Context voor deze aanbieding of upload"
                className="min-h-28"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              onClick={() => void loadChannelHandoff()}
              disabled={handoffLoading}
            >
              {handoffLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Handoff maken...
                </>
              ) : (
                "Genereer handoff"
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {handoffCopyFeedback ?? "Voorbereiding blijft handmatig controleerbaar."}
            </span>
          </div>

          {handoffError ? <p className="text-sm text-destructive">{handoffError}</p> : null}

          {handoffData ? (
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{handoffData.handoff.name}</p>
                <p className="text-sm text-muted-foreground">{handoffData.message}</p>
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Rol</dt>
                  <dd>{handoffData.handoff.role ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Kanaal</dt>
                  <dd>{handoffData.handoff.channelHint ?? "Nog niet opgegeven"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Headline
                  </dt>
                  <dd>{handoffData.handoff.headline ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Notities
                  </dt>
                  <dd>{handoffData.handoff.notes ?? "—"}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Checklist
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {handoffData.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={async () => {
                    await copyText(handoffText);
                    setHandoffCopyFeedback("Handoff gekopieerd");
                    window.setTimeout(() => setHandoffCopyFeedback(null), 2000);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Kopieer handoff
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
