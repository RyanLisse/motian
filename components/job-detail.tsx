import { Calendar, Clock, Euro, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Job } from "@/src/services/jobs";

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

export function JobDetail({ job }: { job: Job }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top section */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <div className="text-sm text-muted-foreground mb-1 font-medium">
            {job.company || "Onbekend"}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
          <div className="text-xs text-muted-foreground mt-1 uppercase">
            {job.externalId || job.id.split("-")[0]}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm text-foreground mb-2">
            Verantwoordelijkheden en taken:
          </h3>
          <p className="text-sm text-muted-foreground">
            {job.description
              ? `${job.description.substring(0, 150)}...`
              : "Geen korte omschrijving beschikbaar."}
          </p>
        </div>

        {job.applicationDeadline && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Sluit over{" "}
            {Math.max(
              0,
              Math.ceil(
                (new Date(job.applicationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              ),
            )}{" "}
            dagen
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-border text-sm">
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Uur per week
            </div>
            <div className="font-medium text-foreground">Niet opgegeven</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Startdatum
            </div>
            <div className="font-medium text-foreground">
              {job.startDate ? new Date(job.startDate).toLocaleDateString("nl-NL") : "In overleg"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Locatie
            </div>
            <div className="font-medium text-foreground">{job.location || "Niet opgegeven"}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
              <Euro className="w-4 h-4" /> Uurtarief
            </div>
            <div className="font-medium text-foreground">
              {job.rateMin && job.rateMax
                ? `EUR${job.rateMin} - EUR${job.rateMax}`
                : job.rateMax
                  ? `max EUR${job.rateMax}`
                  : "Niet opgegeven"}
            </div>
          </div>
        </div>

        <div>
          <span className="text-sm font-semibold text-foreground mr-3">Eisen</span>
          <div className="inline-flex flex-wrap gap-2">
            {job.platform && (
              <Badge
                variant="secondary"
                className="font-normal bg-accent text-muted-foreground border-0"
              >
                {job.platform}
              </Badge>
            )}
            {job.workArrangement && (
              <Badge
                variant="secondary"
                className="font-normal bg-accent text-muted-foreground border-0"
              >
                {arrangementLabels[job.workArrangement] ?? job.workArrangement}
              </Badge>
            )}
            {job.contractType && (
              <Badge
                variant="secondary"
                className="font-normal bg-accent text-muted-foreground capitalize border-0"
              >
                {job.contractType}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Functiebeschrijving</h2>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {job.description}
          </div>
        </div>

        {job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Functie-eisen</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {job.requirements.map((req: string) => (
                <li key={`req-${req}`}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-bold text-lg text-foreground">Stel hier je kandidaat aan</h3>
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          Reageer direct
        </Button>
      </div>
    </div>
  );
}
