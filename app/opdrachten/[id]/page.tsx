import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { eq, desc, isNull, and, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Building2,
  Euro,
  Calendar,
  Clock,
  ExternalLink,
  Sparkles,
  Briefcase,
  Monitor,
  Users,
  Hash,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function SectionBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-[#ececec] mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-sm text-[#8e8e8e] flex items-start gap-2"
          >
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#10a37f] shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function OpdrachtDetailPage({ params }: Props) {
  const { id } = await params;

  // Fetch current job + related jobs in parallel
  const [rows, relatedJobs] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.id, id)).limit(1),
    db
      .select()
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), ne(jobs.id, id)))
      .orderBy(desc(jobs.scrapedAt))
      .limit(4),
  ]);

  const job = rows[0] as typeof jobs.$inferSelect | undefined;

  if (!job) {
    notFound();
  }

  // Fetch related from same company if available
  let related = relatedJobs;
  if (job.company) {
    const companyRelated = await db
      .select()
      .from(jobs)
      .where(
        and(
          isNull(jobs.deletedAt),
          ne(jobs.id, id),
          eq(jobs.company, job.company)
        )
      )
      .orderBy(desc(jobs.scrapedAt))
      .limit(4);
    if (companyRelated.length > 0) {
      related = companyRelated;
    }
  }

  // Extract jsonb fields — items can be strings or {isKnockout, description} objects
  const toStrings = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) =>
      typeof item === "string" ? item : (item as { description?: string })?.description ?? String(item)
    );
  };
  const requirementsList = toStrings(job.requirements);
  const wishesList = toStrings(job.wishes);
  const competencesList = toStrings(job.competences);
  const conditionsList = toStrings(job.conditions);

  // Build AI summary preview from description
  const aiPreview = job.description
    ? job.description.substring(0, 250).trim() + (job.description.length > 250 ? "..." : "")
    : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Center: Job detail */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* Back link (visible on mobile when sidebar is hidden) */}
          <Link
            href="/opdrachten"
            className="inline-flex items-center gap-1.5 text-sm text-[#8e8e8e] hover:text-[#ececec] transition-colors lg:hidden"
          >
            ← Terug naar opdrachten
          </Link>

          {/* Header */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge
                variant="outline"
                className="capitalize border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
              >
                {job.platform}
              </Badge>
              {job.workArrangement && (
                <Badge
                  variant="outline"
                  className={
                    job.workArrangement === "remote"
                      ? "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-xs"
                      : "border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
                  }
                >
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </Badge>
              )}
              {job.contractType && (
                <Badge
                  variant="outline"
                  className="capitalize border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
                >
                  {job.contractType}
                </Badge>
              )}
              {job.contractLabel && (
                <Badge
                  variant="outline"
                  className="border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
                >
                  {job.contractLabel}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-[#ececec] mb-1">{job.title}</h1>
            {job.company && (
              <p className="text-sm text-[#8e8e8e]">{job.company}</p>
            )}
          </div>

          {/* Meta row with icons */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#8e8e8e]">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#6b6b6b]" />
                {job.location}
              </span>
            )}
            {job.workArrangement && (
              <span className="flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-[#6b6b6b]" />
                {arrangementLabels[job.workArrangement] ?? job.workArrangement}
              </span>
            )}
            {(job.rateMin || job.rateMax) && (
              <span className="flex items-center gap-1.5">
                <Euro className="h-4 w-4 text-[#6b6b6b]" />
                {job.rateMin && job.rateMax
                  ? `EUR ${job.rateMin} - ${job.rateMax} per uur`
                  : job.rateMax
                    ? `max EUR ${job.rateMax} per uur`
                    : `min EUR ${job.rateMin} per uur`}
              </span>
            )}
            {job.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#6b6b6b]" />
                {"Start "}
                {new Date(job.startDate).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {/* AI Summary */}
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-[#10a37f]" />
              <h3 className="text-sm font-semibold text-[#ececec]">AI Samenvatting</h3>
            </div>
            {aiPreview ? (
              <p className="text-sm text-[#8e8e8e] leading-relaxed">{aiPreview}</p>
            ) : (
              <p className="text-sm text-[#6b6b6b] italic">Samenvatting wordt gegenereerd...</p>
            )}
          </div>

          {/* Tags / key requirements badges */}
          {competencesList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {competencesList.slice(0, 8).map((comp, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-xs"
                >
                  {comp}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="bg-[#2d2d2d]" />

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="text-base font-semibold text-[#ececec] mb-3">Functiebeschrijving</h3>
              <div className="text-sm text-[#8e8e8e] whitespace-pre-wrap leading-relaxed">
                {job.description}
              </div>
            </div>
          )}

          {/* Structured sections */}
          <SectionBlock title="Functie-eisen" items={requirementsList} />
          <SectionBlock title="Wensen" items={wishesList} />
          <SectionBlock title="Competenties" items={competencesList} />
          <SectionBlock title="Wat bieden we" items={conditionsList} />

          {/* External link */}
          {job.externalUrl && (
            <a href={job.externalUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="border-[#2d2d2d] bg-[#1e1e1e] text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Bekijk op {job.platform}
              </Button>
            </a>
          )}

          <Separator className="bg-[#2d2d2d]" />

          {/* Related jobs */}
          {related.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-[#ececec] mb-4">
                Vergelijkbare opdrachten
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {related.map((rJob) => (
                  <Link key={rJob.id} href={`/opdrachten/${rJob.id}`}>
                    <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-3 hover:border-[#10a37f]/30 hover:bg-[#232323] transition-colors cursor-pointer">
                      <h4 className="text-sm font-semibold text-[#ececec] line-clamp-2 mb-1">
                        {rJob.title}
                      </h4>
                      <p className="text-xs text-[#8e8e8e]">{rJob.company || rJob.platform}</p>
                      {rJob.location && (
                        <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {rJob.location}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="h-8" />
        </div>
      </main>

      {/* Right sidebar: Opdrachtdetails */}
      <aside className="w-[300px] border-l border-[#2d2d2d] bg-[#171717] overflow-y-auto shrink-0 hidden xl:block">
        <div className="p-5 space-y-5">
          <h3 className="text-sm font-semibold text-[#ececec] uppercase tracking-wider">
            Opdrachtdetails
          </h3>

          <dl className="space-y-4 text-sm">
            {job.company && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Opdrachtgever
                </dt>
                <dd className="text-[#ececec] font-medium">{job.company}</dd>
              </div>
            )}
            {job.startDate && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Startdatum
                </dt>
                <dd className="text-[#ececec]">
                  {new Date(job.startDate).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
            {job.endDate && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Einddatum
                </dt>
                <dd className="text-[#ececec]">
                  {new Date(job.endDate).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
            {(job.rateMin || job.rateMax) && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Euro className="h-3.5 w-3.5" /> Uurtarief
                </dt>
                <dd className="text-[#ececec]">
                  {job.rateMin && job.rateMax
                    ? `EUR ${job.rateMin} - ${job.rateMax}`
                    : job.rateMax
                      ? `max EUR ${job.rateMax}`
                      : `min EUR ${job.rateMin}`}
                </dd>
              </div>
            )}
            {job.location && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Locatie
                </dt>
                <dd className="text-[#ececec]">{job.location}</dd>
              </div>
            )}
            {job.workArrangement && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" /> Werkwijze
                </dt>
                <dd className="text-[#ececec]">
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </dd>
              </div>
            )}
            {job.positionsAvailable && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Posities
                </dt>
                <dd className="text-[#ececec]">{job.positionsAvailable}</dd>
              </div>
            )}
            {job.contractLabel && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Contract
                </dt>
                <dd className="text-[#ececec]">{job.contractLabel}</dd>
              </div>
            )}
            {(job.externalId || job.clientReferenceCode) && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> Referentiecode
                </dt>
                <dd className="text-[#ececec] font-mono text-xs">
                  {job.clientReferenceCode || job.externalId}
                </dd>
              </div>
            )}
            {job.applicationDeadline && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Deadline
                </dt>
                <dd className="text-[#ececec]">
                  {new Date(job.applicationDeadline).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
            {job.allowsSubcontracting !== null && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Onderaanneming
                </dt>
                <dd className="text-[#ececec]">
                  {job.allowsSubcontracting ? "Toegestaan" : "Niet toegestaan"}
                </dd>
              </div>
            )}
          </dl>

          <Separator className="bg-[#2d2d2d]" />

          {/* Action buttons */}
          <div className="space-y-2">
            <Button className="w-full bg-[#10a37f] hover:bg-[#10a37f]/90 text-white font-semibold h-10">
              Reageren
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#10a37f] text-[#10a37f] hover:bg-[#10a37f]/10 font-semibold h-10"
            >
              Interesse
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
