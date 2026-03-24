#!/usr/bin/env tsx
/**
 * Fetch ESCO skills taxonomy from the EU API and output as JSON.
 *
 * Walks the ESCO skill tree starting from the root concept,
 * recursively fetching all narrowerConcept links until reaching
 * leaf skills. Outputs a JSON array suitable for import-esco-skills.ts.
 *
 * Usage: pnpm tsx scripts/fetch-esco-dataset.ts > data/esco-skills.json
 */

const API_BASE = "https://ec.europa.eu/esco/api";
const LANGUAGES = ["en", "nl"];
const SKILL_ROOT = "http://data.europa.eu/esco/skill/S";
const KNOWLEDGE_ROOT = "http://data.europa.eu/esco/skill/K"; // transversal knowledge
const FETCH_DELAY_MS = 100; // Be polite to the API
const MAX_CONCURRENT = 5;

type EscoConcept = {
  uri: string;
  preferredLabel: Record<string, string>;
  altLabels?: Record<string, string[]>;
  broaderUri?: string;
  skillType?: string;
  reuseLevel?: string;
};

const seen = new Set<string>();
const skills: EscoConcept[] = [];
let fetched = 0;

async function fetchConcept(uri: string): Promise<any> {
  const params = new URLSearchParams({ uri, language: LANGUAGES.join(",") });
  const url = `${API_BASE}/resource/concept?${params}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error(`[WARN] ${res.status} for ${uri}`);
    return null;
  }
  return res.json();
}

async function fetchSkillResource(uri: string): Promise<any> {
  const params = new URLSearchParams({ uri, language: LANGUAGES.join(",") });
  const url = `${API_BASE}/resource/skill?${params}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  return res.json();
}

function extractLabels(data: any, field: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (data?.[field]) {
    for (const lang of LANGUAGES) {
      if (data[field][lang]) result[lang] = data[field][lang];
    }
  }
  return result;
}

function extractAltLabels(data: any): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (data?.alternativeLabel) {
    for (const lang of LANGUAGES) {
      const labels = data.alternativeLabel[lang];
      if (Array.isArray(labels)) result[lang] = labels;
      else if (typeof labels === "string") result[lang] = [labels];
    }
  }
  if (data?.hiddenLabel) {
    for (const lang of LANGUAGES) {
      const labels = data.hiddenLabel[lang];
      const arr = Array.isArray(labels) ? labels : typeof labels === "string" ? [labels] : [];
      if (arr.length > 0) {
        result[lang] = [...(result[lang] ?? []), ...arr];
      }
    }
  }
  return result;
}

async function walkTree(uri: string, depth = 0): Promise<void> {
  if (seen.has(uri)) return;
  seen.add(uri);

  await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
  let concept: any;
  try {
    concept = await fetchConcept(uri);
  } catch (err) {
    console.error(`[WARN] Failed to fetch concept ${uri}: ${err instanceof Error ? err.message : err}`);
    return;
  }
  if (!concept) return;

  const narrower: string[] = [];
  if (concept._links?.narrowerConcept) {
    const links = Array.isArray(concept._links.narrowerConcept)
      ? concept._links.narrowerConcept
      : [concept._links.narrowerConcept];
    for (const link of links) {
      if (link.uri || link.href) narrower.push(link.uri ?? link.href);
    }
  }
  if (concept._links?.narrowerSkill) {
    const links = Array.isArray(concept._links.narrowerSkill)
      ? concept._links.narrowerSkill
      : [concept._links.narrowerSkill];
    for (const link of links) {
      if (link.uri || link.href) narrower.push(link.uri ?? link.href);
    }
  }

  // If no children, this is a leaf skill — fetch full details
  if (narrower.length === 0 || concept.className === "Skill" || concept.className === "KnowledgeConcept") {
    try {
      const skill = await fetchSkillResource(uri);
      if (skill) {
        const preferred = extractLabels(skill, "preferredLabel");
        if (preferred.en) {
          skills.push({
            uri: skill.uri ?? uri,
            preferredLabel: preferred,
            altLabels: extractAltLabels(skill),
            broaderUri: concept._links?.broaderConcept?.[0]?.uri ?? concept._links?.broaderConcept?.uri,
            skillType: skill.skillType ?? concept.className,
            reuseLevel: skill.reuseLevel,
          });
        }
      }
    } catch (err) {
      console.error(`[WARN] Failed to fetch skill ${uri}: ${err instanceof Error ? err.message : err}`);
    }
    fetched++;
    if (fetched % 100 === 0) console.error(`[progress] ${fetched} skills fetched, ${skills.length} valid`);
    return;
  }

  // Recurse into children (batched)
  console.error(`[depth=${depth}] ${uri} → ${narrower.length} children`);
  for (let i = 0; i < narrower.length; i += MAX_CONCURRENT) {
    const batch = narrower.slice(i, i + MAX_CONCURRENT);
    await Promise.all(batch.map((childUri) => walkTree(childUri, depth + 1)));
  }
}

async function main() {
  console.error("Fetching ESCO skills taxonomy from EU API...");
  console.error(`Root concepts: Skills (S) + Knowledge (K)`);
  console.error(`Languages: ${LANGUAGES.join(", ")}`);

  await walkTree(SKILL_ROOT);
  await walkTree(KNOWLEDGE_ROOT);

  console.error(`\nDone: ${skills.length} skills extracted from ${fetched} leaf concepts`);
  console.log(JSON.stringify(skills, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
