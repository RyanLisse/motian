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
  GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonViewer } from "./json-viewer";

export const revalidate = 120;

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
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const toStrings = (arr: unknown, clean = false): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      const raw = typeof item === "string" ? item : (item as { description?: string })?.description ?? String(item);
      return clean ? stripHtml(raw) : raw;
    }).filter(Boolean);
  };
  const requirementsList = toStrings(job.requirements);
  const wishesList = toStrings(job.wishes);
  const competencesList = toStrings(job.competences, true);
  const conditionsList = toStrings(job.conditions, true);

  // Parse "Label: Value" conditions for sidebar display
  const metaFields = conditionsList
    .map(c => { const i = c.indexOf(": "); return i > 0 ? [c.slice(0, i), c.slice(i + 2)] as [string, string] : null; })
    .filter(Boolean) as [string, string][];
  // Conditions that are NOT key-value pairs stay in the bullet list
  const plainConditions = conditionsList.filter(c => c.indexOf(": ") <= 0);

  // Build AI summary preview from descriptionSummary JSONB
  const extractSummaryText = (summary: unknown): string | null => {
    if (!summary) return null;
    if (typeof summary === 'string') return summary;
    if (typeof summary === 'object') {
      const obj = summary as Record<string, unknown>;
      // JSONB is stored as {en: "...", nl: "..."} — prefer Dutch
      if (typeof obj.nl === 'string') return obj.nl;
      if (typeof obj.en === 'string') return obj.en;
      if (typeof obj.summary === 'string') return obj.summary;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.content === 'string') return obj.content;
    }
    return null;
  };

  // Sanitize HTML: remove empty paragraphs, consecutive <br> tags, etc.
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<p>\s*<br\s*\/?\s*>\s*<\/p>/gi, '')       // Remove <p><br></p>
      .replace(/<p>\s*<\/p>/gi, '')                         // Remove empty <p></p>
      .replace(/(<br\s*\/?\s*>){2,}/gi, '<br>')              // Collapse multiple <br> to one
      .replace(/<p>\s*(<br\s*\/?\s*>\s*)+/gi, '<p>')        // Remove leading <br> in <p>
      .replace(/(<br\s*\/?\s*>\s*)+<\/p>/gi, '</p>')        // Remove trailing <br> in <p>
      .trim();
  };

  const cleanDescription = job.description ? sanitizeHtml(job.description) : null;

  const aiPreview = extractSummaryText(job.descriptionSummary)
    ?? (cleanDescription
      ? cleanDescription.replace(/<[^>]*>?/gm, '').substring(0, 250).trim() + (cleanDescription.replace(/<[^>]*>?/gm, '').length > 250 ? '...' : '')
      : null);

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

          {/* Tags / key requirements badges (short competences only) */}
          {competencesList.filter(c => stripHtml(c).length < 60).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {competencesList.filter(c => stripHtml(c).length < 60).slice(0, 8).map((comp, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-xs"
                >
                  {stripHtml(comp)}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="bg-[#2d2d2d]" />

          {/* Description */}
          {cleanDescription && (
            <div>
              <h3 className="text-base font-semibold text-[#ececec] mb-3">Functiebeschrijving</h3>
              <div 
                className="text-sm text-[#8e8e8e] leading-relaxed max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[#ececec] [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#ececec] [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#ececec] [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-[#ececec] [&_b]:font-semibold [&_b]:text-[#ececec] [&_a]:text-[#10a37f] [&_a]:underline [&_span]:inline"
                dangerouslySetInnerHTML={{ __html: cleanDescription }}
              />
            </div>
          )}

          {/* Structured sections */}
          <SectionBlock title="Functie-eisen" items={requirementsList} />
          <SectionBlock title="Wensen" items={wishesList} />
          <SectionBlock title="Competenties" items={competencesList} />
          <SectionBlock title="Wat bieden we" items={plainConditions} />

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

          {/* Raw JSON debug viewer */}
          <JsonViewer data={job as unknown as Record<string, unknown>} />

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
            {(job.hoursPerWeek || job.minHoursPerWeek) && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Uren per week
                </dt>
                <dd className="text-[#ececec]">
                  {job.minHoursPerWeek && job.hoursPerWeek
                    ? `${job.minHoursPerWeek} - ${job.hoursPerWeek} uur`
                    : job.hoursPerWeek
                      ? `${job.hoursPerWeek} uur`
                      : `${job.minHoursPerWeek} uur (min)`}
                </dd>
              </div>
            )}
            {job.durationMonths && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Looptijd
                </dt>
                <dd className="text-[#ececec]">{job.durationMonths} maanden</dd>
              </div>
            )}
            {job.extensionPossible !== null && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Verlenging mogelijk
                </dt>
                <dd className="text-[#ececec]">{job.extensionPossible ? "Ja" : "Nee"}</dd>
              </div>
            )}
            {job.educationLevel && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Opleidingsniveau
                </dt>
                <dd className="text-[#ececec]">{job.educationLevel}</dd>
              </div>
            )}
            {job.workExperienceYears && (
              <div>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Werkervaring
                </dt>
                <dd className="text-[#ececec]">{job.workExperienceYears} jaar</dd>
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
            {metaFields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[#6b6b6b] text-xs mb-0.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> {label}
                </dt>
                <dd className="text-[#ececec]">{value}</dd>
              </div>
            ))}
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
