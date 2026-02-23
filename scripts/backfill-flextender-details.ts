/**
 * Backfill script: enriches existing Flextender jobs with detail-page content.
 *
 * Usage: npx tsx scripts/backfill-flextender-details.ts
 *
 * What it does:
 *   1. Fetches all Flextender jobs from DB
 *   2. For each, fetches the detail page at /opdracht/?aanvraagnr={externalId}
 *   3. Extracts description, requirements, competences, wishes, conditions
 *   4. Updates the job row in the database
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";
import { stripHtml } from "../src/lib/html";

interface FlextenderJobDetail {
  description?: string;
  requirements?: Array<{ description: string; isKnockout: boolean }>;
  wishes?: Array<{ description: string }>;
  competences?: string[];
  conditions?: string[];
}

const DETAIL_BASE = "https://www.flextender.nl/opdracht/?aanvraagnr=";
const CONCURRENCY = 5;

async function main() {
  // Stap 1: Haal alle Flextender jobs op
  const flxJobs = await db
    .select({ id: jobs.id, externalId: jobs.externalId, title: jobs.title })
    .from(jobs)
    .where(and(eq(jobs.platform, "flextender"), isNull(jobs.deletedAt)));

  console.log(`Found ${flxJobs.length} Flextender jobs to enrich`);

  let enriched = 0;
  let failed = 0;

  // Stap 2: Verrijk in batches
  for (let i = 0; i < flxJobs.length; i += CONCURRENCY) {
    const batch = flxJobs.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (job) => {
        try {
          const detail = await fetchAndParse(job.externalId);
          if (!detail.description && !detail.requirements) {
            console.log(`  SKIP ${job.externalId}: no content found on detail page`);
            failed++;
            return;
          }

          await db
            .update(jobs)
            .set({
              description: detail.description ?? undefined,
              requirements: detail.requirements ?? undefined,
              wishes: detail.wishes ?? undefined,
              competences: detail.competences ?? undefined,
              conditions: detail.conditions ?? undefined,
              externalUrl: `${DETAIL_BASE}${job.externalId}`,
            })
            .where(eq(jobs.id, job.id));

          enriched++;
          console.log(
            `  ✓ ${job.externalId} "${job.title}" — desc=${detail.description?.length ?? 0} chars, ` +
              `reqs=${detail.requirements?.length ?? 0}, comps=${detail.competences?.length ?? 0}`,
          );
        } catch (err) {
          failed++;
          console.log(`  ✗ ${job.externalId}: ${err}`);
        }
      }),
    );

    // Rate-limit pauze
    if (i + CONCURRENCY < flxJobs.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log(`\nDone: ${enriched} enriched, ${failed} failed out of ${flxJobs.length}`);
  process.exit(0);
}

// ── Detail-pagina ophalen en parsen ──

async function fetchAndParse(aanvraagnr: string): Promise<FlextenderJobDetail> {
  const url = `${DETAIL_BASE}${aanvraagnr}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  return parseDetailHtml(html);
}

function parseDetailHtml(html: string): FlextenderJobDetail {
  const result: FlextenderJobDetail = {};

  const descMatch = html.match(
    /class="css-formattedjobdescription">([\s\S]*?)(?:<\/div>\s*<div\s+(?:style|class="css-navigation))/,
  );
  if (!descMatch) return result;

  const content = descMatch[1];
  const sections = extractSections(content);

  const findSection = (needle: string): string | undefined => {
    const key = Object.keys(sections).find((k) => k.toLowerCase().includes(needle.toLowerCase()));
    return key ? sections[key] : undefined;
  };

  // Description
  const descParts: string[] = [];
  for (const key of ["Opdracht", "Organisatietekst", "Opdrachtgever"]) {
    if (sections[key]) descParts.push(sections[key]);
  }
  if (descParts.length > 0) {
    result.description = decodeEntities(descParts.join("\n\n")).substring(0, 8000);
  }

  // Requirements (knock-out)
  const reqText = findSection("vereisten") ?? findSection("knock-out");
  if (reqText) {
    result.requirements = parseNumberedList(reqText).map((item) => ({
      description: item,
      isKnockout: true,
    }));
  }

  // Wishes (selectiecriteria)
  const selText = findSection("selectiecriteria");
  if (selText) {
    result.wishes = parseNumberedList(selText).map((item) => ({
      description: item,
    }));
  }

  // Competences
  const compText = findSection("competenties");
  if (compText) {
    result.competences = parseBulletList(compText);
  }

  // Conditions
  const conditions: string[] = [];

  const funcText = findSection("functieschaal");
  if (funcText) {
    const scaleMatch = funcText.match(/schaal\s*(\d+)/i);
    if (scaleMatch) conditions.push(`Functieschaal ${scaleMatch[1]}`);
  }

  const feeText = findSection("fee");
  if (feeText) conditions.push(`Fee: ${feeText.trim()}`);

  const werkText = findSection("werkdagen");
  if (werkText) conditions.push(`Werkdagen: ${werkText.trim()}`);

  const cvText = findSection("cv-eisen");
  if (cvText) conditions.push(`CV-eisen: ${cvText.trim()}`);

  // Summary fields
  const summaryHtml =
    extractBetween(
      html,
      'class="css-summarybackground">',
      'class="css-formattedjobdescription">',
    ) ?? "";
  const summaryFields = parseFieldPairs(summaryHtml);
  // Fields already mapped to dedicated columns — skip to avoid duplication
  const skipKeys = new Set(["Start", "Regio", "Einde inschrijfdatum"]);
  for (const [key, value] of Object.entries(summaryFields)) {
    if (!value || skipKeys.has(key)) continue;
    const label = key === "Opties verlenging" ? "Verlenging" : key;
    conditions.push(`${label}: ${value}`);
  }

  // Decode HTML entities in all conditions
  if (conditions.length > 0) {
    result.conditions = conditions.map(decodeEntities);
  }

  return result;
}

// ── HTML parsing helpers ──

function extractBetween(html: string, start: string, end: string): string | null {
  const startIdx = html.indexOf(start);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(end, startIdx + start.length);
  if (endIdx === -1) return null;
  return html.substring(startIdx + start.length, endIdx);
}

function extractSections(html: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = html.split(/<(?:strong|b)>/i);

  for (let i = 1; i < parts.length; i++) {
    const closeIdx = parts[i].search(/<\/(?:strong|b)>/i);
    if (closeIdx === -1) continue;

    const header = stripHtml(parts[i].substring(0, closeIdx)).trim();
    const body = stripHtml(parts[i].substring(closeIdx)).trim();

    if (header && body && header.length < 100) {
      sections[header] = body;
    }
  }
  return sections;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&euro;/gi, "€")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&eacute;/gi, "é")
    .replace(/&euml;/gi, "ë")
    .replace(/&uuml;/gi, "ü")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/g, (m) => String.fromCharCode(Number(m.slice(2, -1))));
}

function parseFieldPairs(cardHtml: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const pairRegex = /class="css-caption">([^<]+)<[\s\S]*?class="css-value">([^<]+)</gi;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = pairRegex.exec(cardHtml)) !== null) {
    const key = pairMatch[1].trim();
    const value = pairMatch[2].trim();
    if (!fields[key]) fields[key] = value;
  }
  return fields;
}

function parseNumberedList(text: string): string[] {
  const items = text.split(/\n/).filter((l) => l.trim());
  const result: string[] = [];
  for (const line of items) {
    const cleaned = line.replace(/^\d+[.)]\s*/, "").trim();
    if (cleaned.length > 5) result.push(cleaned);
  }
  if (result.length === 0) {
    return text
      .split(/[;\n]/)
      .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
      .filter((s) => s.length > 5);
  }
  return result;
}

function parseBulletList(text: string): string[] {
  return text
    .split(/[;\n]/)
    .map((s) => s.replace(/^[-•–]\s*/, "").trim())
    .filter((s) => s.length > 2);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
