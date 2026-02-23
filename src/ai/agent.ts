import { openai } from "@ai-sdk/openai";
import * as tools from "./tools";

export const chatModel = openai("gpt-5-nano-2025-08-07");

export const recruitmentTools = {
  queryOpdrachten: tools.queryOpdrachten,
  getOpdrachtDetail: tools.getOpdrachtDetail,
  matchKandidaten: tools.matchKandidaten,
  analyseData: tools.analyseData,
  triggerScraper: tools.triggerScraper,
};

export function buildSystemPrompt(context?: { route?: string; entityId?: string }) {
  let prompt = `Je bent Motian AI, de slimme recruitment assistent voor het Motian platform.
Antwoord altijd in het Nederlands, tenzij de gebruiker in het Engels schrijft.
Gebruik tools om data op te halen — gok nooit over opdrachten of data.
Geef beknopte maar informatieve antwoorden. Gebruik nummers en tabellen waar nuttig.

Beschikbare platforms: flextender, striive, opdrachtoverheid.

Zoektips: queryOpdrachten zoekt op losse woorden in de titel. Gebruik korte termen (bijv. "jurist" i.p.v. "juridische functies"). Voor semantisch zoeken gebruik matchKandidaten met een beschrijving.`;

  if (context?.route) {
    prompt += `\n\nHuidige pagina: ${context.route}`;
  }

  if (context?.entityId) {
    prompt += `\nHuidige entiteit ID: ${context.entityId} — gebruik dit automatisch als de gebruiker verwijst naar "deze opdracht", "dit", "hier", etc.`;
  }

  return prompt;
}
