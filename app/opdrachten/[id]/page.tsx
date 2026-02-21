import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Euro,
  Calendar,
  Clock,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

function JsonSection({
  title,
  items,
}: {
  title: string;
  items: unknown;
}) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-sm text-muted-foreground flex items-start gap-2"
            >
              <span className="text-primary mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function OpdrachtDetailPage({ params }: Props) {
  const { id } = await params;

  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  const job = rows[0];

  if (!job) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <Link href="/opdrachten">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar opdrachten
        </Button>
      </Link>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3 flex-wrap mb-3">
            <Badge
              variant="outline"
              className="capitalize border-border text-muted-foreground"
            >
              {job.platform}
            </Badge>
            {job.workArrangement && (
              <Badge
                variant="outline"
                className={
                  job.workArrangement === "remote"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "border-border text-muted-foreground"
                }
              >
                {arrangementLabels[job.workArrangement] ?? job.workArrangement}
              </Badge>
            )}
            {job.contractType && (
              <Badge
                variant="outline"
                className="capitalize border-border text-muted-foreground"
              >
                {job.contractType}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {job.company && (
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {job.company}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
          )}
          {(job.rateMin || job.rateMax) && (
            <span className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              {job.rateMin && job.rateMax
                ? `EUR ${job.rateMin} - ${job.rateMax} per uur`
                : job.rateMax
                  ? `max EUR ${job.rateMax} per uur`
                  : `min EUR ${job.rateMin} per uur`}
            </span>
          )}
          {job.applicationDeadline && (
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Deadline:{" "}
              {new Date(job.applicationDeadline).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Geplaatst:{" "}
              {new Date(job.postedAt).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {job.externalUrl && (
          <a
            href={job.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="border-border">
              <ExternalLink className="h-4 w-4 mr-2" />
              Bekijk op {job.platform}
            </Button>
          </a>
        )}

        <Separator className="bg-border" />

        {/* Description */}
        {job.description && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Beschrijving</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {job.description}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Structured sections */}
        <div className="grid gap-4 md:grid-cols-2">
          <JsonSection title="Eisen" items={job.requirements} />
          <JsonSection title="Wensen" items={job.wishes} />
          <JsonSection title="Competenties" items={job.competences} />
          <JsonSection title="Voorwaarden" items={job.conditions} />
        </div>

        {/* Additional details */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {job.externalId && (
                <>
                  <dt className="text-muted-foreground">Referentie</dt>
                  <dd className="text-foreground font-mono text-xs">{job.externalId}</dd>
                </>
              )}
              {job.clientReferenceCode && (
                <>
                  <dt className="text-muted-foreground">Klant referentie</dt>
                  <dd className="text-foreground font-mono text-xs">{job.clientReferenceCode}</dd>
                </>
              )}
              {job.contractLabel && (
                <>
                  <dt className="text-muted-foreground">Broker</dt>
                  <dd className="text-foreground">{job.contractLabel}</dd>
                </>
              )}
              {job.positionsAvailable && (
                <>
                  <dt className="text-muted-foreground">Posities</dt>
                  <dd className="text-foreground">{job.positionsAvailable}</dd>
                </>
              )}
              {job.startDate && (
                <>
                  <dt className="text-muted-foreground">Startdatum</dt>
                  <dd className="text-foreground">
                    {new Date(job.startDate).toLocaleDateString("nl-NL")}
                  </dd>
                </>
              )}
              {job.endDate && (
                <>
                  <dt className="text-muted-foreground">Einddatum</dt>
                  <dd className="text-foreground">
                    {new Date(job.endDate).toLocaleDateString("nl-NL")}
                  </dd>
                </>
              )}
              {job.allowsSubcontracting !== null && (
                <>
                  <dt className="text-muted-foreground">Onderaanneming</dt>
                  <dd className="text-foreground">
                    {job.allowsSubcontracting ? "Ja" : "Nee"}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
