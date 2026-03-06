import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { Calendar, Euro, ExternalLink, Link2, MapPin, Monitor, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DroppableVacancy } from "@/components/droppable-vacancy";
import { LinkCandidatesDialog } from "@/components/link-candidates-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { stripHtml } from "@/src/lib/html";
import { JobDetailFields } from "./job-detail-fields";
import { JsonViewer } from "./json-viewer";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

function SectionBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function OpdrachtDetailPage({ params }: Props) {
  const { id } = await params;

  // Fetch current job
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .limit(1);

  const job = rows[0] as typeof jobs.$inferSelect | undefined;

  if (!job) {
    notFound();
  }

  // Fetch company-related and generic related jobs in parallel
  const [companyRelated, genericRelated] = await Promise.all([
    job.company
      ? db
          .select()
          .from(jobs)
          .where(and(isNull(jobs.deletedAt), ne(jobs.id, id), eq(jobs.company, job.company)))
          .orderBy(desc(jobs.scrapedAt))
          .limit(4)
      : Promise.resolve([]),
    db
      .select()
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), ne(jobs.id, id)))
      .orderBy(desc(jobs.scrapedAt))
      .limit(4),
  ]);

  const related = companyRelated.length > 0 ? companyRelated : genericRelated;

  // Extract jsonb fields — items can be strings or {isKnockout, description} objects
  const toStrings = (arr: unknown, clean = false): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        const raw =
          typeof item === "string"
            ? item
            : ((item as { description?: string })?.description ?? String(item));
        return clean ? stripHtml(raw) : raw;
      })
      .filter(Boolean);
  };
  const requirementsList = toStrings(job.requirements);
  const wishesList = toStrings(job.wishes);
  const competencesList = toStrings(job.competences, true);
  const conditionsList = toStrings(job.conditions, true);

  // Parse "Label: Value" conditions for sidebar display
  const metaFields = conditionsList
    .map((c) => {
      const i = c.indexOf(": ");
      return i > 0 ? ([c.slice(0, i), c.slice(i + 2)] as [string, string]) : null;
    })
    .filter(Boolean) as [string, string][];
  // Conditions that are NOT key-value pairs stay in the bullet list
  const plainConditions = conditionsList.filter((c) => c.indexOf(": ") <= 0);

  // Build AI summary preview from descriptionSummary JSONB
  const extractSummaryText = (summary: unknown): string | null => {
    if (!summary) return null;
    if (typeof summary === "string") return summary;
    if (typeof summary === "object") {
      const obj = summary as Record<string, unknown>;
      // JSONB is stored as {en: "...", nl: "..."} — prefer Dutch
      if (typeof obj.nl === "string") return obj.nl;
      if (typeof obj.en === "string") return obj.en;
      if (typeof obj.summary === "string") return obj.summary;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.content === "string") return obj.content;
    }
    return null;
  };

  // Sanitize HTML: remove empty paragraphs, consecutive <br> tags, etc.
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<p>\s*<br\s*\/?\s*>\s*<\/p>/gi, "") // Remove <p><br></p>
      .replace(/<p>\s*<\/p>/gi, "") // Remove empty <p></p>
      .replace(/(<br\s*\/?\s*>){2,}/gi, "<br>") // Collapse multiple <br> to one
      .replace(/<p>\s*(<br\s*\/?\s*>\s*)+/gi, "<p>") // Remove leading <br> in <p>
      .replace(/(<br\s*\/?\s*>\s*)+<\/p>/gi, "</p>") // Remove trailing <br> in <p>
      .trim();
  };

  // Visual scoring tier block renderer
  const renderScoringTiers = (
    tiers: { letter: string; desc: string; points: number }[],
  ): string => {
    const maxPoints = Math.max(...tiers.map((t) => t.points));
    let html =
      '<div style="display:grid;gap:8px;margin:12px 0 16px 0;padding:14px 16px;border-radius:10px;border:1px solid var(--border);background:var(--card);">';
    for (const tier of tiers) {
      const pct = maxPoints > 0 ? Math.round((tier.points / maxPoints) * 100) : 0;
      const isMax = tier.points === maxPoints && tier.points > 0;
      const isZero = tier.points === 0;
      const color = isZero ? "#6b7280" : isMax ? "#10b981" : "#3b82f6";
      html += `<div style="display:flex;align-items:center;gap:10px;${isMax ? `background:${color}0d;margin:0 -8px;padding:6px 8px;border-radius:8px;` : ""}">`;
      html += `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:${color}18;color:${color};font-size:11px;font-weight:700;flex-shrink:0;">${tier.letter}</span>`;
      html += `<span style="flex:1;font-size:13px;color:${isMax ? "var(--foreground)" : "var(--muted-foreground)"};line-height:1.4;${isMax ? "font-weight:600;" : ""}">${tier.desc}</span>`;
      html += `<div style="width:60px;height:6px;border-radius:99px;background:var(--border);overflow:hidden;flex-shrink:0;">`;
      html += `<div style="width:${pct}%;height:100%;border-radius:99px;background:${color};"></div>`;
      html += "</div>";
      html += `<span style="font-size:12px;font-weight:700;color:${color};min-width:32px;text-align:right;">${tier.points}pt</span>`;
      html += "</div>";
    }
    html += "</div>";
    return html;
  };

  // Enhance scoring criteria sections visually
  const enhanceScoringCriteria = (html: string): string => {
    // 1. Enhance "Gunningscriteria" headings into gradient banners
    let enhanced = html.replace(
      /<h3([^>]*)>(Gunningscriteria[^<]*)<\/h3>/gi,
      (_match, _attrs, text: string) => {
        const totalMatch = text.match(/totaal\s+(\d+)\s*punten/i);
        const total = totalMatch ? totalMatch[1] : null;
        return `<div style="margin:20px 0 12px 0;padding:14px 16px;border-radius:10px;background:linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 70%, #7c3aed) 100%);color:white;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:14px;font-weight:700;">⚖️ Gunningscriteria</div>
              <div style="font-size:12px;opacity:0.85;margin-top:2px;">Beoordeeld door Flextender</div>
            </div>
            ${total ? `<div style="text-align:center;background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:8px;backdrop-filter:blur(4px);"><div style="font-size:20px;font-weight:800;">${total}</div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.9;">punten</div></div>` : ""}
          </div>
        </div>`;
      },
    );

    // 2. Enhance scoring tier lines (a. desc (N punten); b. desc (N punten); ...)
    enhanced = enhanced.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, content: string) => {
      if (!/[a-d]\.\s+.*?\(\d+\s*punten?\)/i.test(content)) return match;
      const tierRegex = /([a-d])\.\s+(.+?)\s*\((\d+)\s*punten?\)/gi;
      const tiers: { letter: string; desc: string; points: number }[] = [];
      let m: RegExpExecArray | null = tierRegex.exec(content);
      while (m !== null) {
        tiers.push({ letter: m[1].toUpperCase(), desc: m[2].trim(), points: parseInt(m[3], 10) });
        m = tierRegex.exec(content);
      }
      if (tiers.length < 2) return match;
      return renderScoringTiers(tiers);
    });

    return enhanced;
  };

  // Convert plain text with section patterns into structured HTML
  const isHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

  // Strip trailing metadata blob (OpdrachtgeverXxx...Referentiecode...)
  const stripTrailingMeta = (text: string): string =>
    text.replace(/Opdrachtgever[A-Z][^\n]*?(Referentiecode(?:code)?\s*\w+)\s*$/, "").trim();

  const formatPlainText = (text: string): string => {
    const cleaned = stripTrailingMeta(text);
    const lines = cleaned.split("\n");
    const blocks: string[] = [];
    let i = 0;

    // Check if a line is a heading
    const isHeadingLine = (line: string, idx: number): boolean => {
      if (line.length > 100 || line.endsWith(",") || line.endsWith(";") || /^\d+\.\s/.test(line))
        return false;
      // Known Dutch heading patterns
      if (
        /^(uitvoeringsvoorwaarde|opdracht(gever|omschrijving)?|vereisten|gunningscriteria|competenties|overige?\s*(informatie)?|beoordeling|functieschaal|fee flextender|cv-eisen|werkdagen|taken|profiel|algemeen|probleem|benodigd aantal|stap \d|geen zzp|overig)/i.test(
          line,
        )
      )
        return true;
      // Line ending with colon is a heading (e.g. "Taken:", "Profiel:")
      if (/^[A-Z].*:$/.test(line) && line.length < 80) return true;
      // Short line, no period, starts with capital — check next line is longer
      if (line.length < 70 && !line.endsWith(".") && /^[A-Z]/.test(line)) {
        let j = idx + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        const next = lines[j]?.trim() ?? "";
        return next.length > line.length || j >= lines.length;
      }
      return false;
    };

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // Collect consecutive numbered list items (1. 2. 3. ...)
      if (/^\d+\.\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s*/, ""));
          i++;
        }
        blocks.push(
          `<ol class="list-decimal pl-5 mb-3 space-y-1">${items.map((it) => `<li>${it}</li>`).join("")}</ol>`,
        );
        continue;
      }

      // Collect consecutive bullet items (- ..., bullet ..., or space-indented lines, or o sub-bullets)
      if (/^[-\u2022]\s/.test(line) || /^o\s+\S/.test(line)) {
        const items: string[] = [];
        while (
          i < lines.length &&
          (/^[-\u2022]\s/.test(lines[i].trim()) || /^o\s+\S/.test(lines[i].trim()))
        ) {
          items.push(lines[i].trim().replace(/^[-\u2022o]\s*/, ""));
          i++;
        }
        blocks.push(
          `<ul class="list-disc pl-5 mb-3 space-y-1">${items.map((it) => `<li>${it}</li>`).join("")}</ul>`,
        );
        continue;
      }

      // Space-indented lines (common in Opdrachtoverheid for task/profile lists)
      if (/^\s{1,4}\S/.test(lines[i]) && lines[i].trim().length > 10) {
        const items: string[] = [];
        while (
          i < lines.length &&
          /^\s{1,4}\S/.test(lines[i]) &&
          lines[i].trim().length > 10 &&
          !isHeadingLine(lines[i].trim(), i)
        ) {
          items.push(lines[i].trim());
          i++;
        }
        if (items.length > 0) {
          blocks.push(
            `<ul class="list-disc pl-5 mb-3 space-y-1">${items.map((it) => `<li>${it}</li>`).join("")}</ul>`,
          );
          continue;
        }
      }

      // Section heading detection
      if (isHeadingLine(line, i)) {
        blocks.push(`<h3 class="text-sm font-semibold text-foreground mt-5 mb-2">${line}</h3>`);
        i++;
        continue;
      }

      // Regular paragraph — collect consecutive non-empty, non-special lines
      const pLines: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\d+\.\s/.test(lines[i].trim()) &&
        !/^[-\u2022]\s/.test(lines[i].trim()) &&
        !/^o\s+\S/.test(lines[i].trim()) &&
        !/^\s{1,4}\S/.test(lines[i]) &&
        !isHeadingLine(lines[i].trim(), i)
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      blocks.push(`<p class="mb-3">${pLines.join(" ")}</p>`);
    }

    return blocks.join("");
  };

  const cleanDescription = job.description
    ? enhanceScoringCriteria(
        isHtml(job.description) ? sanitizeHtml(job.description) : formatPlainText(job.description),
      )
    : null;

  const aiPreview =
    extractSummaryText(job.descriptionSummary) ??
    (cleanDescription
      ? cleanDescription
          .replace(/<[^>]*>?/gm, "")
          .substring(0, 250)
          .trim() + (cleanDescription.replace(/<[^>]*>?/gm, "").length > 250 ? "..." : "")
      : null);

  return (
    <DroppableVacancy jobId={job.id} jobTitle={job.title}>
      <div className="flex flex-1 overflow-hidden">
        {/* Center: Job detail */}
        <main className="flex-1 overflow-y-auto pb-[72px] xl:pb-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
            {/* Back link */}
            <Link
              href="/opdrachten"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Terug naar vacatures
            </Link>

            {/* Header */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge
                  variant="outline"
                  className="capitalize border-border text-muted-foreground bg-transparent text-xs"
                >
                  {job.platform}
                </Badge>
                {job.workArrangement && (
                  <Badge
                    variant="outline"
                    className={
                      job.workArrangement === "remote"
                        ? "bg-primary/10 text-primary border-primary/20 text-xs"
                        : "border-border text-muted-foreground bg-transparent text-xs"
                    }
                  >
                    {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                  </Badge>
                )}
                {job.contractType && (
                  <Badge
                    variant="outline"
                    className="capitalize border-border text-muted-foreground bg-transparent text-xs"
                  >
                    {job.contractType}
                  </Badge>
                )}
                {job.contractLabel && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground bg-transparent text-xs"
                  >
                    {job.contractLabel}
                  </Badge>
                )}
                <div className="ml-auto">
                  <JsonViewer data={job as unknown as Record<string, unknown>} />
                </div>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground mb-1">{job.title}</h1>
              {job.company && <p className="text-sm text-muted-foreground">{job.company}</p>}
            </div>

            {/* Meta row with icons */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  {job.location}
                </span>
              )}
              {job.workArrangement && (
                <span className="flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </span>
              )}
              {(job.rateMin || job.rateMax) && (
                <span className="flex items-center gap-1.5">
                  <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
                  {job.rateMin && job.rateMax
                    ? `EUR ${job.rateMin} - ${job.rateMax} per uur`
                    : job.rateMax
                      ? `max EUR ${job.rateMax} per uur`
                      : `min EUR ${job.rateMin} per uur`}
                </span>
              )}
              {job.startDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
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
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">AI Samenvatting</h3>
              </div>
              {aiPreview ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{aiPreview}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Samenvatting wordt gegenereerd...
                </p>
              )}
            </div>

            {/* Mobile opdrachtdetails (visible below xl) */}
            <div className="bg-card border border-border rounded-lg p-4 xl:hidden">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                Opdrachtdetails
              </h3>
              <JobDetailFields job={job} variant="mobile" />
            </div>

            {/* Tags / key requirements badges (short competences only) */}
            {competencesList.filter((c) => stripHtml(c).length < 60).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competencesList
                  .filter((c) => stripHtml(c).length < 60)
                  .slice(0, 8)
                  .map((comp) => (
                    <Badge
                      key={comp}
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 text-xs"
                    >
                      {stripHtml(comp)}
                    </Badge>
                  ))}
              </div>
            )}

            <Separator className="bg-border" />

            {/* Description */}
            {cleanDescription && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">
                  Functiebeschrijving
                </h3>
                <div
                  className="text-sm text-muted-foreground leading-relaxed max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_b]:font-semibold [&_b]:text-foreground [&_a]:text-primary [&_a]:underline [&_span]:inline"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Job descriptions from scrapers contain formatted HTML that must be rendered; content is sanitized by stripHtml in the scraper pipeline
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
                  className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk op {job.platform}
                </Button>
              </a>
            )}

            <Separator className="bg-border" />

            {/* Related jobs */}
            {related.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Vergelijkbare vacatures
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {related.map((rJob) => (
                    <Link key={rJob.id} href={`/opdrachten/${rJob.id}`}>
                      <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/30 hover:bg-accent transition-colors cursor-pointer">
                        <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
                          {rJob.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {rJob.company || rJob.platform}
                        </p>
                        {rJob.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
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

        {/* Right sidebar: Opdrachtdetails (desktop xl+ only) */}
        <aside className="w-[300px] border-l border-border bg-sidebar overflow-y-auto shrink-0 hidden xl:block">
          <div className="p-5 space-y-5">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Opdrachtdetails
            </h3>

            <JobDetailFields job={job} variant="desktop" metaFields={metaFields} />

            <Separator className="bg-border" />

            {/* Action buttons */}
            <div className="space-y-2">
              <Link href={`/matching?jobId=${job.id}`} className="block w-full">
                <Button variant="outline" className="w-full border-border font-semibold h-10">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Match kandidaten
                </Button>
              </Link>
              <LinkCandidatesDialog
                jobId={job.id}
                jobTitle={job.title}
                trigger={
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10">
                    <Link2 className="h-4 w-4 mr-2" />
                    Koppel aan kandidaat
                  </Button>
                }
              />
              <Button
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/10 font-semibold h-10"
              >
                Interesse
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile sticky bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 flex gap-2 xl:hidden z-50">
          <LinkCandidatesDialog
            jobId={job.id}
            jobTitle={job.title}
            trigger={
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11">
                <Link2 className="h-4 w-4 mr-2" />
                Koppel aan kandidaat
              </Button>
            }
          />
          <Button
            variant="outline"
            className="flex-1 border-primary text-primary hover:bg-primary/10 font-semibold h-11"
          >
            Interesse
          </Button>
        </div>
      </div>
    </DroppableVacancy>
  );
}
