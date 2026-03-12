import { HYBRID_BLEND, SCORING_WEIGHTS } from "@/src/services/scoring";
import { getWorkspaceSummary } from "@/src/services/workspace";
import * as tools from "./tools";

type AgentContext = {
  route?: string | null;
  entityId?: string | null;
  entityType?: string | null;
} | null;

const opdrachtTools = {
  queryOpdrachten: tools.queryOpdrachten,
  getOpdrachtDetail: tools.getOpdrachtDetail,
  updateOpdracht: tools.updateOpdracht,
  verwijderOpdracht: tools.verwijderOpdracht,
  matchKandidaten: tools.matchKandidaten,
  analyseData: tools.analyseData,
  triggerScraper: tools.triggerScraper,
  importeerOpdrachtenBatch: tools.importeerOpdrachtenBatch,
  runKandidaatScoringBatch: tools.runKandidaatScoringBatch,
  reviewGdprRetentie: tools.reviewGdprRetentie,
};

const platformTools = {
  platformsList: tools.platformsList,
  platformCatalogCreate: tools.platformCatalogCreate,
  platformCatalogUpdate: tools.platformCatalogUpdate,
  platformConfigCreate: tools.platformConfigCreate,
  platformConfigUpdate: tools.platformConfigUpdate,
  platformConfigValidate: tools.platformConfigValidate,
  platformTestImport: tools.platformTestImport,
  platformActivate: tools.platformActivate,
  platformOnboardingStatus: tools.platformOnboardingStatus,
};

const kandidaatTools = {
  zoekKandidaten: tools.zoekKandidaten,
  getKandidaatDetail: tools.getKandidaatDetail,
  maakKandidaatAan: tools.maakKandidaatAan,
  updateKandidaat: tools.updateKandidaat,
  verwijderKandidaat: tools.verwijderKandidaat,
  voegNotitieToe: tools.voegNotitieToe,
  autoMatchKandidaat: tools.autoMatchKandidaat,
};

const matchTools = {
  zoekMatches: tools.zoekMatches,
  getMatchDetail: tools.getMatchDetail,
  maakMatchAan: tools.maakMatchAan,
  keurMatchGoed: tools.keurMatchGoed,
  wijsMatchAf: tools.wijsMatchAf,
  verwijderMatch: tools.verwijderMatch,
  voerStructuredMatchUit: tools.voerStructuredMatchUit,
};

const sollicitatieTools = {
  zoekSollicitaties: tools.zoekSollicitaties,
  getSollicitatieDetail: tools.getSollicitatieDetail,
  maakSollicitatieAan: tools.maakSollicitatieAan,
  updateSollicitatieFase: tools.updateSollicitatieFase,
  verwijderSollicitatie: tools.verwijderSollicitatie,
  getSollicitatieStats: tools.getSollicitatieStats,
};

const interviewTools = {
  zoekInterviews: tools.zoekInterviews,
  getInterviewDetail: tools.getInterviewDetail,
  planInterview: tools.planInterview,
  updateInterview: tools.updateInterviewTool,
  verwijderInterview: tools.verwijderInterview,
};

const berichtTools = {
  zoekBerichten: tools.zoekBerichten,
  getBerichtDetail: tools.getBerichtDetail,
  stuurBericht: tools.stuurBericht,
  verwijderBericht: tools.verwijderBericht,
};

const gdprTools = {
  exporteerKandidaatData: tools.exporteerKandidaatData,
  wisKandidaatData: tools.wisKandidaatData,
  scrubContactGegevens: tools.scrubContactGegevens,
  exporteerContactData: tools.exporteerContactData,
};

export const recruitmentTools = {
  ...opdrachtTools,
  ...platformTools,
  ...kandidaatTools,
  ...matchTools,
  ...sollicitatieTools,
  ...interviewTools,
  ...berichtTools,
  ...gdprTools,
};

function isOpdrachtContext(context?: AgentContext) {
  return (
    context?.entityType === "opdracht" ||
    context?.route?.includes("/opdrachten") ||
    context?.route?.includes("/scraper")
  );
}

function isKandidaatContext(context?: AgentContext) {
  return (
    context?.entityType === "kandidaat" ||
    context?.route?.includes("/professionals") ||
    context?.route?.includes("/kandidaten")
  );
}

function getCapabilityLines(context?: AgentContext): string[] {
  if (isOpdrachtContext(context)) {
    return [
      "Opdrachten zoeken, filteren, bijwerken en verwijderen",
      "Kandidaten matchen op opdrachten en matchresultaten beoordelen",
      "Sollicitaties bekijken en pipeline-fases bijwerken",
      "Data analyseren (tarieven, platforms, deadlines)",
      "Scrapers en scoring-batches starten voor opdrachten",
      "Platform onboarding beheren: catalogus, config, validatie en smoke imports",
    ];
  }

  if (isKandidaatContext(context)) {
    return [
      "Kandidaten beheren (zoeken, aanmaken, bijwerken, verwijderen)",
      "Notities toevoegen aan kandidaatprofielen",
      "Kandidaten zoeken op vaardigheden, rol, naam of locatie",
      "Kandidaten en opdrachten matchen, inclusief structured matching",
      "Sollicitaties, interviews en berichten rondom kandidaten beheren",
      "GDPR-acties uitvoeren voor kandidaten en contactgegevens",
    ];
  }

  return [
    "Opdrachten zoeken, filteren, bijwerken en verwijderen",
    "Kandidaten beheren (zoeken, aanmaken, bijwerken, verwijderen)",
    "Notities toevoegen aan kandidaatprofielen",
    "Kandidaten zoeken op vaardigheden, rol, naam of locatie",
    "Automatisch matchen van kandidaten met vacatures (top 3 met gedetailleerde beoordeling)",
    "Diepgaande gestructureerde matching (Mariënne-methodologie) met knock-out criteria en gunningscriteria",
    "Matches aanmaken, bekijken, goedkeuren, afwijzen en verwijderen",
    "Sollicitaties aanmaken en door de pipeline verplaatsen",
    "Interviews plannen en bijwerken",
    "Berichten versturen en bekijken",
    "Data analyseren (tarieven, platforms, deadlines)",
    "Scrapers starten voor nieuwe opdrachten",
    "Batch import draaien over actieve scrapers (importeerOpdrachtenBatch)",
    "Platform onboarding beheren: catalogus, config, validatie, test-import en activatie",
    "Batch scoring draaien over actieve opdrachten (runKandidaatScoringBatch)",
    "GDPR retentie review uitvoeren (reviewGdprRetentie)",
    "GDPR: kandidaatdata exporteren, permanent verwijderen, contactgegevens scrubben",
  ];
}

export function getRecruitmentTools(context?: AgentContext) {
  if (isOpdrachtContext(context)) {
    return {
      ...opdrachtTools,
      ...platformTools,
      ...matchTools,
      ...sollicitatieTools,
    };
  }

  if (isKandidaatContext(context)) {
    return {
      ...kandidaatTools,
      ...matchTools,
      ...sollicitatieTools,
      ...interviewTools,
      ...berichtTools,
      ...gdprTools,
    };
  }

  return recruitmentTools;
}

/** Build workspace context string for prompt injection. */
async function getWorkspaceContext(): Promise<{
  platformSlugs: string[];
  text: string;
}> {
  try {
    const summary = await getWorkspaceSummary();

    const scraperLines = summary.scraperHealth.platforms
      .map(
        (h) =>
          `  ${h.platform}: ${h.status}${h.lastRunAt ? ` (laatste run: ${new Date(h.lastRunAt).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })})` : ""}`,
      )
      .join("\n");
    const catalogLines = summary.scraperHealth.catalog
      .map((entry) => {
        const configState = entry.configured ? "geconfigureerd" : "nog niet geconfigureerd";
        const blocker = entry.blockerKind ? ` · blocker: ${entry.blockerKind}` : "";
        return `  ${entry.slug}: ${entry.displayName} (${entry.adapterKind}, ${configState})${blocker}`;
      })
      .join("\n");

    return {
      platformSlugs: summary.scraperHealth.catalog.map((entry) => entry.slug),
      text: `
Werkruimte overzicht:
- Opdrachten: ${summary.jobs.total} actief (${summary.jobs.withEmbedding} met embeddings)
- Kandidaten: ${summary.candidates.total} actief
- Matches: ${summary.matches.total} totaal (${summary.matches.pending} pending review)
- Scraper gezondheid: ${summary.scraperHealth.overall}
- Platformen: ${summary.scraperHealth.configuredPlatforms}/${summary.scraperHealth.supportedPlatforms} geconfigureerd, ${summary.scraperHealth.pendingOnboarding} onboarding flows open
${scraperLines}

Platform catalogus:
${catalogLines}`,
    };
  } catch {
    return { platformSlugs: [], text: "" };
  }
}

export async function buildSystemPrompt(context?: AgentContext) {
  const now = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Amsterdam",
  });

  const workspace = await getWorkspaceContext();
  const platformSlugs =
    workspace.platformSlugs.length > 0 ? workspace.platformSlugs.join(", ") : "-";
  const capabilityLines = getCapabilityLines(context)
    .map((line) => `- ${line}`)
    .join("\n");

  let prompt = `Je bent Motian AI, de slimme recruitment assistent voor het Motian platform.
Antwoord altijd in het Nederlands, tenzij de gebruiker in het Engels schrijft.
Gebruik tools om data op te halen — gok nooit over opdrachten of data.
Geef beknopte maar informatieve antwoorden. Gebruik nummers en tabellen waar nuttig.

Vandaag is ${now}.

Beschikbare platform-slugs (dynamische catalogus): ${platformSlugs}.

Je kunt helpen met:
${capabilityLines}

Belangrijk: Vraag ALTIJD om expliciete bevestiging van de gebruiker voordat je wisKandidaatData aanroept. Dit verwijdert alle data permanent en kan niet ongedaan worden gemaakt.

Matching gewichten (totaal 100): Skills ${SCORING_WEIGHTS.skills}%, Locatie ${SCORING_WEIGHTS.location}%, Tarief ${SCORING_WEIGHTS.rate}%, Rol ${SCORING_WEIGHTS.role}%.
Hybride scoring: ${Math.round(HYBRID_BLEND.ruleWeight * 100)}% regelgebaseerd + ${Math.round(HYBRID_BLEND.vectorWeight * 100)}% semantisch (indien embeddings beschikbaar).

Zoektips: queryOpdrachten zoekt op losse woorden in de titel. Gebruik korte termen (bijv. "jurist" i.p.v. "juridische functies"). Voor semantisch zoeken gebruik matchKandidaten met een beschrijving.

Tarief-vragen: Voor "hoogste tarief" of "duurste vacature" gebruik queryOpdrachten met sortBy="tarief_hoog" en limit=5 (ZONDER q). Voor tarief-statistieken gebruik analyseData met analysis="top_tarieven" of "avg_rates". Gebruik NOOIT rateMin/rateMax filters als de gebruiker alleen wil weten wat het hoogste/laagste tarief is.
${workspace.text}`;

  if (context?.route) {
    prompt += `\n\nHuidige pagina: ${context.route}`;
  }

  if (context?.entityId) {
    const typeLabel = context.entityType ?? "entiteit";
    prompt += `\nHuidige ${typeLabel} ID: ${context.entityId} — gebruik dit automatisch als de gebruiker verwijst naar "deze ${typeLabel}", "dit", "hier", etc.`;
  }

  return prompt;
}
