import { extractBySelector, extractFieldValue } from "@motian/scrapers";
import { Output } from "ai";
import { z } from "zod";
import { geminiFlash, tracedGenerateText as generateText } from "../lib/ai-models";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";
const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_TIMEOUT_MS = 45_000;

// ─── Types ──────────────────────────────────────────────

type DynamicScrapingStrategy = {
  listSelector: string;
  linkSelector: string;
  fieldMapping: Record<string, string>;
  paginationType: string;
  paginationSelector?: string;
  maxPages: number;
  needsDetailPage: boolean;
};

export type StrategyVerificationInput = {
  url: string;
  strategy: DynamicScrapingStrategy;
};

export type VerificationConfidence = "high" | "medium" | "low";

export type SelectorFix = {
  field: string;
  currentSelector: string;
  suggestedSelector: string;
  reason: string;
};

export type StrategyVerificationResult = {
  confidence: VerificationConfidence;
  score: number;
  issues: string[];
  suggestedFixes: SelectorFix[];
  correctedStrategy?: DynamicScrapingStrategy;
  attempts: number;
};

// ─── Scorecard Schema ──────────────────────────────────

const scorecardSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  score: z
    .number()
    .min(0)
    .max(100)
    .describe("Betrouwbaarheidsscore 0-100 van de selector-strategie"),
  issues: z.array(z.string()).describe("Lijst van gevonden problemen (Nederlands)"),
  suggestedFixes: z.array(
    z.object({
      field: z
        .string()
        .describe("Veldnaam of selector-type (listSelector, fieldMapping.title, etc)"),
      currentSelector: z.string().describe("Huidige CSS selector"),
      suggestedSelector: z.string().describe("Voorgestelde verbeterde selector"),
      reason: z.string().describe("Reden voor de wijziging"),
    }),
  ),
});

// ─── Evidence Collection ───────────────────────────────

type VerificationEvidence = {
  screenshotBase64: string | null;
  html: string;
  extractedRecords: Record<string, string>[];
  listElementCount: number;
};

async function collectEvidence(
  url: string,
  strategy: DynamicScrapingStrategy,
): Promise<VerificationEvidence> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  let html = "";
  let screenshotBase64: string | null = null;

  // Fetch page with screenshot via Firecrawl
  if (apiKey) {
    try {
      const response = await fetch(FIRECRAWL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["html", "screenshot"],
          waitFor: 3000,
          timeout: 30000,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          success: boolean;
          data?: { html?: string; screenshot?: string };
        };
        if (data.success && data.data) {
          html = data.data.html ?? "";
          screenshotBase64 = data.data.screenshot ?? null;
        }
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  // Fallback: direct fetch (no screenshot)
  if (!html) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Pagina ophalen mislukt: HTTP ${response.status}`);
    }
    html = await response.text();
  }

  // Extract records using the strategy's selectors
  const listElements = extractBySelector(html, strategy.listSelector);
  const extractedRecords: Record<string, string>[] = [];

  for (const element of listElements.slice(0, 5)) {
    const record: Record<string, string> = {};
    for (const [field, selector] of Object.entries(strategy.fieldMapping)) {
      const value = extractFieldValue(element, selector);
      if (value) record[field] = value;
    }
    if (Object.keys(record).length > 0) {
      extractedRecords.push(record);
    }
  }

  return {
    screenshotBase64,
    html,
    extractedRecords,
    listElementCount: listElements.length,
  };
}

// ─── Sanitize HTML ─────────────────────────────────────

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on\w+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, "")
    .slice(0, 10_000);
}

// ─── Model Verification ────────────────────────────────

async function verifyWithModel(
  evidence: VerificationEvidence,
  strategy: DynamicScrapingStrategy,
): Promise<z.infer<typeof scorecardSchema>> {
  const promptParts: Array<{ type: "text"; text: string } | { type: "image"; image: Buffer }> = [];

  // Add screenshot if available
  if (evidence.screenshotBase64) {
    promptParts.push({
      type: "image",
      image: Buffer.from(evidence.screenshotBase64, "base64"),
    });
  }

  promptParts.push({
    type: "text",
    text: `Je bent een expert in web scraping verificatie. Controleer of de CSS-selectors overeenkomen met de zichtbare inhoud van de pagina.

## Scraping Strategie
\`\`\`json
${JSON.stringify(strategy, null, 2)}
\`\`\`

## Geëxtraheerde Records (eerste ${evidence.extractedRecords.length} van ${evidence.listElementCount} elementen)
\`\`\`json
${JSON.stringify(evidence.extractedRecords, null, 2)}
\`\`\`

## HTML Fragment (gesaniteerd, eerste 10k tekens)
\`\`\`html
${sanitizeHtml(evidence.html)}
\`\`\`

## Opdracht
1. Vergelijk de zichtbare inhoud${evidence.screenshotBase64 ? " (screenshot)" : ""} met de geëxtraheerde records
2. Controleer of listSelector daadwerkelijk vacature-elementen selecteert
3. Controleer of fieldMapping-selectors de juiste velden extraheren (titel, bedrijf, locatie, etc.)
4. Beoordeel of paginationType correct is
5. Identificeer problemen: verkeerde selectors, gemiste velden, lege extracties, selector drift

Geef een score (0-100) en confidence level:
- high (80+): Selectors werken correct, data klopt
- medium (50-79): Meeste selectors werken, kleine problemen
- low (<50): Ernstige problemen, selectors matchen niet

Als je verbeteringen ziet, geef concrete suggestedFixes met betere CSS-selectors.`,
  });

  const { output } = await generateText({
    model: geminiFlash,
    output: Output.object({ schema: scorecardSchema }),
    messages: [{ role: "user", content: promptParts }],
  });

  if (!output) {
    return {
      confidence: "medium",
      score: 50,
      issues: ["Model retourneerde geen gestructureerd resultaat — handmatige controle aanbevolen"],
      suggestedFixes: [],
    };
  }

  return output;
}

// ─── Auto-Correct ──────────────────────────────────────

function applySuggestedFixes(
  strategy: DynamicScrapingStrategy,
  fixes: SelectorFix[],
): DynamicScrapingStrategy {
  const corrected = { ...strategy, fieldMapping: { ...strategy.fieldMapping } };

  for (const fix of fixes) {
    if (fix.field === "listSelector") {
      corrected.listSelector = fix.suggestedSelector;
    } else if (fix.field === "linkSelector") {
      corrected.linkSelector = fix.suggestedSelector;
    } else if (fix.field.startsWith("fieldMapping.")) {
      const mappingKey = fix.field.replace("fieldMapping.", "");
      corrected.fieldMapping[mappingKey] = fix.suggestedSelector;
    } else if (fix.field in corrected.fieldMapping) {
      corrected.fieldMapping[fix.field] = fix.suggestedSelector;
    }
  }

  return corrected;
}

// ─── Main Entry Point ──────────────────────────────────

export async function verifyPlatformStrategyMultimodal(
  input: StrategyVerificationInput,
): Promise<StrategyVerificationResult> {
  let currentStrategy = input.strategy;
  let lastScorecard: z.infer<typeof scorecardSchema> | null = null;

  const deadline = Date.now() + VERIFICATION_TIMEOUT_MS;

  for (let attempt = 1; attempt <= MAX_VERIFICATION_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) {
      return {
        confidence: lastScorecard?.confidence ?? "medium",
        score: lastScorecard?.score ?? 50,
        issues: [
          ...(lastScorecard?.issues ?? []),
          "Verificatie timeout bereikt — resultaat gebaseerd op laatste poging",
        ],
        suggestedFixes: lastScorecard?.suggestedFixes ?? [],
        correctedStrategy: attempt > 1 ? currentStrategy : undefined,
        attempts: attempt,
      };
    }

    const evidence = await collectEvidence(input.url, currentStrategy);
    lastScorecard = await verifyWithModel(evidence, currentStrategy);

    // If confidence is not low, or this is the last attempt, return
    if (lastScorecard.confidence !== "low" || attempt === MAX_VERIFICATION_ATTEMPTS) {
      return {
        confidence: lastScorecard.confidence,
        score: lastScorecard.score,
        issues: lastScorecard.issues,
        suggestedFixes: lastScorecard.suggestedFixes,
        correctedStrategy: attempt > 1 ? currentStrategy : undefined,
        attempts: attempt,
      };
    }

    // Apply fixes for next attempt
    if (lastScorecard.suggestedFixes.length > 0) {
      currentStrategy = applySuggestedFixes(currentStrategy, lastScorecard.suggestedFixes);
    } else {
      // No fixes suggested but low confidence — can't improve, bail out
      return {
        confidence: lastScorecard.confidence,
        score: lastScorecard.score,
        issues: lastScorecard.issues,
        suggestedFixes: [],
        attempts: attempt,
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    confidence: "low",
    score: 0,
    issues: ["Verificatie mislukt na maximaal aantal pogingen"],
    suggestedFixes: [],
    attempts: MAX_VERIFICATION_ATTEMPTS,
  };
}

// ─── Gate Decision ─────────────────────────────────────

export function gateDecision(
  result: StrategyVerificationResult,
): "continue" | "continue_monitored" | "block" {
  if (result.confidence === "high") return "continue";
  if (result.confidence === "medium") return "continue_monitored";
  return "block";
}
