import { PLATFORMS } from "@/src/lib/helpers";
import { HYBRID_BLEND, SCORING_WEIGHTS } from "@/src/services/scoring";
import { getWorkspaceSummary } from "@/src/services/workspace";
import * as tools from "./tools";

export const recruitmentTools = {
  // Opdrachten
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

  // Kandidaten
  zoekKandidaten: tools.zoekKandidaten,
  getKandidaatDetail: tools.getKandidaatDetail,
  maakKandidaatAan: tools.maakKandidaatAan,
  updateKandidaat: tools.updateKandidaat,
  verwijderKandidaat: tools.verwijderKandidaat,
  voegNotitieToe: tools.voegNotitieToe,
  autoMatchKandidaat: tools.autoMatchKandidaat,

  // Matches
  zoekMatches: tools.zoekMatches,
  getMatchDetail: tools.getMatchDetail,
  maakMatchAan: tools.maakMatchAan,
  keurMatchGoed: tools.keurMatchGoed,
  wijsMatchAf: tools.wijsMatchAf,
  verwijderMatch: tools.verwijderMatch,
  voerStructuredMatchUit: tools.voerStructuredMatchUit,

  // Sollicitaties
  zoekSollicitaties: tools.zoekSollicitaties,
  getSollicitatieDetail: tools.getSollicitatieDetail,
  maakSollicitatieAan: tools.maakSollicitatieAan,
  updateSollicitatieFase: tools.updateSollicitatieFase,
  verwijderSollicitatie: tools.verwijderSollicitatie,
  getSollicitatieStats: tools.getSollicitatieStats,

  // Interviews
  zoekInterviews: tools.zoekInterviews,
  getInterviewDetail: tools.getInterviewDetail,
  planInterview: tools.planInterview,
  updateInterview: tools.updateInterviewTool,
  verwijderInterview: tools.verwijderInterview,

  // Berichten
  zoekBerichten: tools.zoekBerichten,
  getBerichtDetail: tools.getBerichtDetail,
  stuurBericht: tools.stuurBericht,
  verwijderBericht: tools.verwijderBericht,

  // GDPR
  exporteerKandidaatData: tools.exporteerKandidaatData,
  wisKandidaatData: tools.wisKandidaatData,
  scrubContactGegevens: tools.scrubContactGegevens,
  exporteerContactData: tools.exporteerContactData,
};

/** Build workspace context string for prompt injection. */
async function getWorkspaceContext(): Promise<string> {
  try {
    const summary = await getWorkspaceSummary();

    const scraperLines = summary.scraperHealth.platforms
      .map(
        (h) =>
          `  ${h.platform}: ${h.status}${h.lastRunAt ? ` (laatste run: ${new Date(h.lastRunAt).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })})` : ""}`,
      )
      .join("\n");

    return `
Werkruimte overzicht:
- Opdrachten: ${summary.jobs.total} actief (${summary.jobs.withEmbedding} met embeddings)
- Kandidaten: ${summary.candidates.total} actief
- Matches: ${summary.matches.total} totaal (${summary.matches.pending} pending review)
- Scraper gezondheid: ${summary.scraperHealth.overall}
${scraperLines}`;
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(
  context?: {
    route?: string | null;
    entityId?: string | null;
    entityType?: string | null;
  } | null,
) {
  const now = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Amsterdam",
  });

  const workspace = await getWorkspaceContext();

  let prompt = `Je bent Motian AI, de slimme recruitment assistent voor het Motian platform.
Antwoord altijd in het Nederlands, tenzij de gebruiker in het Engels schrijft.
Gebruik tools om data op te halen — gok nooit over opdrachten of data.
Geef beknopte maar informatieve antwoorden. Gebruik nummers en tabellen waar nuttig.

Vandaag is ${now}.

Beschikbare platforms: ${PLATFORMS.join(", ")}.

Je kunt helpen met:
- Opdrachten zoeken, filteren, bijwerken en verwijderen
- Kandidaten beheren (zoeken, aanmaken, bijwerken, verwijderen)
- Notities toevoegen aan kandidaatprofielen
- Kandidaten zoeken op vaardigheden, rol, naam of locatie
- Automatisch matchen van kandidaten met vacatures (top 3 met gedetailleerde beoordeling)
- Diepgaande gestructureerde matching (Mariënne-methodologie) met knock-out criteria en gunningscriteria
- Matches aanmaken, bekijken, goedkeuren, afwijzen en verwijderen
- Sollicitaties aanmaken en door de pipeline verplaatsen
- Interviews plannen en bijwerken
- Berichten versturen en bekijken
- Data analyseren (tarieven, platforms, deadlines)
- Scrapers starten voor nieuwe opdrachten
- Batch import draaien over actieve scrapers (importeerOpdrachtenBatch)
- Batch scoring draaien over actieve opdrachten (runKandidaatScoringBatch)
- GDPR retentie review uitvoeren (reviewGdprRetentie)
- GDPR: kandidaatdata exporteren, permanent verwijderen, contactgegevens scrubben

Belangrijk: Vraag ALTIJD om expliciete bevestiging van de gebruiker voordat je wisKandidaatData aanroept. Dit verwijdert alle data permanent en kan niet ongedaan worden gemaakt.

Matching gewichten (totaal 100): Skills ${SCORING_WEIGHTS.skills}%, Locatie ${SCORING_WEIGHTS.location}%, Tarief ${SCORING_WEIGHTS.rate}%, Rol ${SCORING_WEIGHTS.role}%.
Hybride scoring: ${Math.round(HYBRID_BLEND.ruleWeight * 100)}% regelgebaseerd + ${Math.round(HYBRID_BLEND.vectorWeight * 100)}% semantisch (indien embeddings beschikbaar).

Zoektips: queryOpdrachten zoekt op losse woorden in de titel. Gebruik korte termen (bijv. "jurist" i.p.v. "juridische functies"). Voor semantisch zoeken gebruik matchKandidaten met een beschrijving.
${workspace}`;

  if (context?.route) {
    prompt += `\n\nHuidige pagina: ${context.route}`;
  }

  if (context?.entityId) {
    const typeLabel = context.entityType ?? "entiteit";
    prompt += `\nHuidige ${typeLabel} ID: ${context.entityId} — gebruik dit automatisch als de gebruiker verwijst naar "deze ${typeLabel}", "dit", "hier", etc.`;
  }

  return prompt;
}
