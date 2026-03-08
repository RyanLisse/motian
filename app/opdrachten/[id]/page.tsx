import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import {
  ArrowRight,
  Award,
  Calendar,
  Clock,
  Euro,
  ExternalLink,
  Kanban,
  Link2,
  MapPin,
  Monitor,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AIGrading } from "@/components/ai-grading";
import { DroppableVacancy } from "@/components/droppable-vacancy";
import { LinkCandidatesDialog } from "@/components/link-candidates-dialog";
import { OpdrachtDetailEndClientFilter } from "@/components/opdracht-detail-end-client-filter";
import { OpdrachtenDetailSheet } from "@/components/opdrachten-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { db } from "@/src/db";
import { applications, candidates, jobMatches, jobs } from "@/src/db/schema";
import { stripHtml } from "@/src/lib/html";
import { getGradedCandidates } from "@/src/services/grading";
import { getVisibleVacancyCondition } from "@/src/services/jobs/filters";
import { JobDetailFields } from "./job-detail-fields";
import { JsonViewer } from "./json-viewer";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

const PIPELINE_STAGES = [
  { key: "new", label: "Nieuw", color: "bg-yellow-500" },
  { key: "screening", label: "Screening", color: "bg-blue-500" },
  { key: "interview", label: "Interview", color: "bg-purple-500" },
  { key: "offer", label: "Aanbod", color: "bg-orange-500" },
  { key: "hired", label: "Geplaatst", color: "bg-primary" },
] as const;

const PIPELINE_STAGE_STYLES: Record<string, string> = {
  new: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  screening: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  interview: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  offer: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hired: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Geplaatst",
  rejected: "Afgewezen",
};

const MATCH_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

const APPLICATION_SOURCE_LABELS: Record<string, string> = {
  manual: "Handmatig",
  match: "AI match",
  import: "Import",
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PIPELINE_STAGE_PRIORITY: Record<string, number> = {
  new: 0,
  screening: 1,
  interview: 2,
  offer: 3,
  hired: 4,
  rejected: 5,
};

const PIPELINE_NEXT_STEP_HINTS: Record<string, string> = {
  new: "Kies wie door mag naar screening",
  screening: "Werk de shortlist naar interview toe",
  interview: "Plan het eerstvolgende interviewmoment",
  offer: "Volg het openstaande aanbod op",
  hired: "Houd de plaatsing warm tot de startdatum",
  rejected: "Bekijk de historie als extra context",
};

function getDeadlineState(deadline?: Date | string | null) {
  if (!deadline) return null;

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return null;

  const deadlineDay = new Date(parsedDeadline);
  deadlineDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remainingDays = Math.round((deadlineDay.getTime() - today.getTime()) / DAY_IN_MS);
  const formattedDate = parsedDeadline.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (remainingDays < 0) {
    return {
      label: "Deadline verlopen",
      hint: `De vacature sloot op ${formattedDate}. Gebruik vooral bestaande koppelingen als context.`,
      className: "border-destructive/20 bg-destructive/10 text-destructive",
    };
  }

  if (remainingDays === 0) {
    return {
      label: "Sluit vandaag",
      hint: "Beslis vandaag wie je wilt opvolgen of koppelen.",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (remainingDays === 1) {
    return {
      label: "Sluit morgen",
      hint: "Rond vandaag nog je shortlist of eerste screening af.",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (remainingDays <= 3) {
    return {
      label: `Nog ${remainingDays} dagen`,
      hint: "Plan deze week je eerstvolgende stap richting screening of interview.",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    label: `Deadline ${formattedDate}`,
    hint: "Nog voldoende tijd, maar een vroege shortlist versnelt opvolging.",
    className: "border-border bg-background text-muted-foreground",
  };
}

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

export default async function OpdrachtDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;

  // Fetch current job
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

  const job = rows[0] as typeof jobs.$inferSelect | undefined;

  if (!job) {
    notFound();
  }

  // Fetch company-related jobs, generic related jobs, and pipeline data in parallel
  const [
    companyRelated,
    genericRelated,
    pipelineCounts,
    recentPipelineRows,
    gradedCandidates,
    endClientRows,
  ] = await Promise.all([
    job.company
      ? db
          .select()
          .from(jobs)
          .where(
            and(
              getVisibleVacancyCondition(),
              eq(jobs.status, "open"),
              ne(jobs.id, id),
              eq(jobs.company, job.company),
            ),
          )
          .orderBy(desc(jobs.scrapedAt))
          .limit(4)
      : Promise.resolve([]),
    db
      .select()
      .from(jobs)
      .where(and(getVisibleVacancyCondition(), eq(jobs.status, "open"), ne(jobs.id, id)))
      .orderBy(desc(jobs.scrapedAt))
      .limit(4),
    // Pipeline counts per stage for this job
    db
      .select({
        stage: applications.stage,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(and(eq(applications.jobId, id), isNull(applications.deletedAt)))
      .groupBy(applications.stage),
    // Recent linked candidates for this job
    db
      .select({
        id: applications.id,
        stage: applications.stage,
        source: applications.source,
        candidateId: candidates.id,
        candidateName: candidates.name,
        candidateRole: candidates.role,
        candidateLocation: candidates.location,
        matchScore: jobMatches.matchScore,
        matchStatus: jobMatches.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .leftJoin(candidates, eq(applications.candidateId, candidates.id))
      .leftJoin(jobMatches, eq(applications.matchId, jobMatches.id))
      .where(and(eq(applications.jobId, id), isNull(applications.deletedAt)))
      .orderBy(desc(applications.updatedAt), desc(applications.createdAt))
      .limit(4),
    getGradedCandidates({ jobId: job.id, limit: 12 }),
    db
      .select({ endClient: persistedEndClient })
      .from(jobs)
      .where(getVisibleVacancyCondition())
      .groupBy(persistedEndClient)
      .orderBy(persistedEndClient),
  ]);

  // Build pipeline summary
  // Pipeline stages: only active stages count toward totalPipeline.
  // "rejected" is excluded from the active pipeline (consistent with overzicht page).
  const stageCountMap: Record<string, number> = {};
  for (const row of pipelineCounts) {
    stageCountMap[row.stage] = row.count;
  }
  // Active pipeline total excludes rejected — "pipeline" = candidates still in process
  const totalPipeline = PIPELINE_STAGES.reduce((s, st) => s + (stageCountMap[st.key] ?? 0), 0);
  const rejectedCount = stageCountMap.rejected ?? 0;
  const recruiterCockpitRows = [...recentPipelineRows].sort((a, b) => {
    const stageDelta =
      (PIPELINE_STAGE_PRIORITY[a.stage] ?? Number.MAX_SAFE_INTEGER) -
      (PIPELINE_STAGE_PRIORITY[b.stage] ?? Number.MAX_SAFE_INTEGER);
    if (stageDelta !== 0) return stageDelta;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
  const gradingHref = `/opdrachten/${job.id}#ai-grading`;
  const pipelineHref = `/pipeline?vacature=${job.id}`;
  const nextPipelineAction =
    (stageCountMap.new ?? 0) > 0
      ? {
          label: `${stageCountMap.new} nieuwe kandidaten screenen`,
          href: `/pipeline?vacature=${job.id}&fase=new`,
        }
      : (stageCountMap.screening ?? 0) > 0
        ? {
            label: `${stageCountMap.screening} kandidaten opvolgen in screening`,
            href: `/pipeline?vacature=${job.id}&fase=screening`,
          }
        : (stageCountMap.interview ?? 0) > 0
          ? {
              label: `${stageCountMap.interview} interviews voorbereiden`,
              href: `/pipeline?vacature=${job.id}&fase=interview`,
            }
          : (stageCountMap.offer ?? 0) > 0
            ? {
                label: `${stageCountMap.offer} aanbiedingen opvolgen`,
                href: `/pipeline?vacature=${job.id}&fase=offer`,
              }
            : null;
  const deadlineState = getDeadlineState(job.applicationDeadline);

  const related = companyRelated.length > 0 ? companyRelated : genericRelated;
  const currentEndClient = job.endClient?.trim() || job.company?.trim() || null;
  const endClientOptions = [
    ...new Set(
      endClientRows
        .map((row) => row.endClient?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const currentListParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry) currentListParams.append(key, entry);
    }
  }

  const listQuery = currentListParams.toString();
  const listHref = listQuery ? `/opdrachten?${listQuery}` : "/opdrachten";
  const buildDetailHref = (jobId: string) =>
    listQuery ? `/opdrachten/${jobId}?${listQuery}` : `/opdrachten/${jobId}`;

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
      <OpdrachtenDetailSheet
        title={job.title}
        description={job.company ?? undefined}
        listHref={listHref}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
            <Link
              href={listHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; Terug naar vacatures
            </Link>

            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-transparent text-xs capitalize text-muted-foreground"
                >
                  {job.platform}
                </Badge>
                {job.workArrangement && (
                  <Badge
                    variant="outline"
                    className={
                      job.workArrangement === "remote"
                        ? "border-primary/20 bg-primary/10 text-xs text-primary"
                        : "bg-transparent text-xs text-muted-foreground"
                    }
                  >
                    {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                  </Badge>
                )}
                {job.contractType && (
                  <Badge
                    variant="outline"
                    className="bg-transparent text-xs capitalize text-muted-foreground"
                  >
                    {job.contractType}
                  </Badge>
                )}
                {job.contractLabel && (
                  <Badge variant="outline" className="bg-transparent text-xs text-muted-foreground">
                    {job.contractLabel}
                  </Badge>
                )}
                {deadlineState ? (
                  <Badge variant="outline" className={`gap-1 text-xs ${deadlineState.className}`}>
                    <Clock className="h-3 w-3" />
                    {deadlineState.label}
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={
                    totalPipeline > 0
                      ? "border-primary/20 bg-primary/10 text-xs text-primary"
                      : "border-dashed border-border bg-transparent text-xs text-muted-foreground"
                  }
                >
                  {totalPipeline > 0
                    ? `${totalPipeline} actief in shortlist`
                    : "Nog geen shortlist"}
                </Badge>
                <div className="ml-auto">
                  <JsonViewer data={job as unknown as Record<string, unknown>} />
                </div>
              </div>
              <h1 className="text-lg font-bold text-foreground sm:text-xl">{job.title}</h1>
              {job.company ? (
                <p className="mt-1 text-sm text-muted-foreground">{job.company}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {job.location}
                </span>
              )}
              {job.workArrangement && (
                <span className="flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </span>
              )}
              {(job.rateMin || job.rateMax) && (
                <span className="flex items-center gap-1.5">
                  <Euro className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {job.rateMin && job.rateMax
                    ? `EUR ${job.rateMin} - ${job.rateMax} per uur`
                    : job.rateMax
                      ? `max EUR ${job.rateMax} per uur`
                      : `min EUR ${job.rateMin} per uur`}
                </span>
              )}
              {job.startDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Start{" "}
                  {new Date(job.startDate).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
              <OpdrachtDetailEndClientFilter
                endClients={endClientOptions}
                currentEndClient={currentEndClient}
              />

              <section
                id="recruiter-cockpit"
                className="scroll-mt-24 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">Recruiter cockpit</h2>
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/10 text-[10px] text-primary"
                      >
                        {totalPipeline > 0 ? `${totalPipeline} actief` : "Nog leeg"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Zie direct welke fase aandacht vraagt en open vanuit deze vacature meteen AI
                      aanbevelingen, grading of de juiste vervolgstap.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LinkCandidatesDialog
                      jobId={job.id}
                      jobTitle={job.title}
                      trigger={
                        <Button variant="outline" size="sm" className="border-border">
                          <Sparkles className="mr-2 h-4 w-4" />
                          AI aanbevelingen
                        </Button>
                      }
                    />
                    <Button asChild variant="outline" size="sm" className="border-border">
                      <Link href={gradingHref}>
                        <Award className="mr-2 h-4 w-4" />
                        AI Grading
                      </Link>
                    </Button>
                    {totalPipeline > 0 ? (
                      <Button
                        asChild
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Link href={pipelineHref}>
                          <Kanban className="mr-2 h-4 w-4" />
                          Bekijk pipeline
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <a href="#koppel-kandidaten">
                          <Link2 className="mr-2 h-4 w-4" />
                          Koppel aan kandidaat
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {deadlineState?.label ?? "Geen deadline bekend"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {deadlineState?.hint ??
                        "Zonder harde sluitdatum kun je tempo bepalen vanuit de shortlist."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Shortlist</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {totalPipeline > 0
                        ? `${totalPipeline} kandidaat${totalPipeline === 1 ? "" : "en"} actief`
                        : "Nog geen shortlist"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {totalPipeline > 0
                        ? "Open de pipeline om te zien wie nu aandacht vraagt."
                        : "Gebruik AI aanbevelingen of topmatches hieronder om screening te starten."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Direct doen</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {nextPipelineAction?.label ?? "Koppel top-3 matches aan screening"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nextPipelineAction
                        ? "De snelste route naar de eerstvolgende recruiteractie."
                        : "Selecties hieronder komen direct in screening terecht."}
                    </p>
                  </div>
                </div>

                {totalPipeline === 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Nog geen kandidaten gekoppeld aan deze vacature.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Start met de top-3 suggesties hieronder of open matching voor extra opties.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {PIPELINE_STAGES.map((stage) => {
                        const count = stageCountMap[stage.key] ?? 0;
                        if (count === 0) return null;
                        return (
                          <div
                            key={stage.key}
                            className="rounded-lg border border-border bg-background/60 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">{stage.label}</span>
                              <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                            </div>
                            <p className="mt-1 text-lg font-semibold text-foreground">{count}</p>
                          </div>
                        );
                      })}
                    </div>

                    {nextPipelineAction ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Volgende actie
                          </p>
                          <p className="text-sm text-foreground">{nextPipelineAction.label}</p>
                        </div>
                        <Link
                          href={nextPipelineAction.href}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          Open fase
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                      Vacaturedetails
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Alle kernvelden van deze vacature in één compacte panelweergave.
                    </p>
                  </div>
                  {job.externalUrl ? (
                    <Button asChild variant="outline" size="sm" className="border-border">
                      <a href={job.externalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Bekijk op {job.platform}
                      </a>
                    </Button>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <JobDetailFields job={job} variant="desktop" metaFields={metaFields} />
                </dl>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Gekoppelde kandidaten</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Kandidaten die al aan deze vacature gekoppeld zijn.
                    </p>
                  </div>
                  <Link
                    href={pipelineHref}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Alles bekijken
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {recruiterCockpitRows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nog geen kandidaten gekoppeld aan deze vacature.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {recruiterCockpitRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-border bg-background/60 p-3"
                      >
                        {PIPELINE_NEXT_STEP_HINTS[row.stage] ? (
                          <div className="mb-3 rounded-md border border-border/70 bg-card px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Volgende stap
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {PIPELINE_NEXT_STEP_HINTS[row.stage]}
                            </p>
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {row.candidateId ? (
                              <Link
                                href={`/professionals/${row.candidateId}`}
                                className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                              >
                                {row.candidateName ?? "Onbekende kandidaat"}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">
                                {row.candidateName ?? "Onbekende kandidaat"}
                              </p>
                            )}
                            {row.candidateRole || row.candidateLocation ? (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                {[row.candidateRole, row.candidateLocation]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${PIPELINE_STAGE_STYLES[row.stage] ?? "border-border text-muted-foreground"}`}
                            >
                              {PIPELINE_STAGE_LABELS[row.stage] ?? row.stage}
                            </Badge>
                            {row.matchStatus ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${MATCH_STATUS_STYLES[row.matchStatus] ?? "border-border text-muted-foreground"}`}
                              >
                                {MATCH_STATUS_LABELS[row.matchStatus] ?? row.matchStatus}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {row.matchScore != null ? (
                            <span className="font-medium text-foreground">
                              {Math.round(row.matchScore)}% match
                            </span>
                          ) : null}
                          {row.source ? (
                            <span>Bron: {APPLICATION_SOURCE_LABELS[row.source] ?? row.source}</span>
                          ) : null}
                          {row.createdAt ? (
                            <span>
                              Gekoppeld op{" "}
                              {new Date(row.createdAt).toLocaleDateString("nl-NL", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {row.candidateId ? (
                            <Link
                              href={`/professionals/${row.candidateId}`}
                              className="text-primary hover:underline"
                            >
                              Open profiel
                            </Link>
                          ) : null}
                          <Link
                            href={`/pipeline?vacature=${job.id}&fase=${row.stage}`}
                            className="text-primary hover:underline"
                          >
                            Open fase
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rejectedCount > 0 ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {rejectedCount} afgewezen kandidaat
                    {rejectedCount === 1 ? " blijft" : "en blijven"} beschikbaar in de volledige
                    pipelinehistorie.
                  </p>
                ) : null}
              </section>

              <section
                id="koppel-kandidaten"
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">
                        Nog te koppelen kandidaten
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Selecties uit de top-3 gaan direct naar screening. Open recruiter context of
                      grading voor extra onderbouwing.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-border">
                    <Link href={gradingHref}>
                      <Award className="mr-2 h-4 w-4" />
                      Open AI Grading
                    </Link>
                  </Button>
                </div>

                <div className="mt-4">
                  <LinkCandidatesDialog jobId={job.id} jobTitle={job.title} variant="inline" />
                </div>
              </section>

              <section id="ai-grading" className="scroll-mt-24">
                <AIGrading candidates={gradedCandidates} />
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">AI Samenvatting</h2>
                </div>
                {aiPreview ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{aiPreview}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Samenvatting wordt gegenereerd...
                  </p>
                )}
              </section>

              {competencesList.filter((c) => stripHtml(c).length < 60).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {competencesList
                    .filter((c) => stripHtml(c).length < 60)
                    .slice(0, 8)
                    .map((comp) => (
                      <Badge
                        key={comp}
                        variant="outline"
                        className="border-primary/20 bg-primary/10 text-xs text-primary"
                      >
                        {stripHtml(comp)}
                      </Badge>
                    ))}
                </div>
              ) : null}

              <Separator className="bg-border" />

              {cleanDescription ? (
                <section>
                  <h2 className="mb-3 text-base font-semibold text-foreground">
                    Functiebeschrijving
                  </h2>
                  <div
                    className="max-w-none text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_b]:font-semibold [&_b]:text-foreground [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_span]:inline [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Job descriptions from scrapers contain formatted HTML that must be rendered; content is sanitized by stripHtml in the scraper pipeline
                    dangerouslySetInnerHTML={{ __html: cleanDescription }}
                  />
                </section>
              ) : null}

              <SectionBlock title="Functie-eisen" items={requirementsList} />
              <SectionBlock title="Wensen" items={wishesList} />
              <SectionBlock title="Competenties" items={competencesList} />
              <SectionBlock title="Wat bieden we" items={plainConditions} />

              {related.length > 0 ? (
                <section>
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Vergelijkbare vacatures
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {related.map((rJob) => (
                      <Link key={rJob.id} href={buildDetailHref(rJob.id)}>
                        <div className="cursor-pointer rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-accent">
                          <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">
                            {rJob.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {rJob.company || rJob.platform}
                          </p>
                          {rJob.location ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {rJob.location}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </OpdrachtenDetailSheet>
    </DroppableVacancy>
  );
}
