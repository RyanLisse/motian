import { getCandidateById } from "./candidates";

export type ChannelOfferHandoffInput = {
  candidateId: string;
  channelHint?: string;
  notes?: string;
};

export type ChannelOfferHandoffResult =
  | { ok: false; error: string }
  | {
      ok: true;
      status: "not_configured";
      message: string;
      handoff: {
        candidateId: string;
        name: string;
        role: string | null;
        headline: string | null;
        channelHint: string | null;
        notes: string | null;
      };
      checklist: string[];
    };

/**
 * Issue #148: external channel APIs are not wired; returns structured handoff for agents/MCP.
 */
export async function prepareChannelOfferHandoff(
  input: ChannelOfferHandoffInput,
): Promise<ChannelOfferHandoffResult> {
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    return { ok: false, error: "Kandidaat niet gevonden" };
  }

  return {
    ok: true,
    status: "not_configured",
    message:
      "Externe kanaal-submissie is nog niet geactiveerd. Gebruik de gegevens hieronder voor handmatige plaatsing of koppel later een provider.",
    handoff: {
      candidateId: candidate.id,
      name: candidate.name,
      role: candidate.role,
      headline: candidate.headline,
      channelHint: input.channelHint ?? null,
      notes: input.notes ?? null,
    },
    checklist: [
      "Controleer toestemming (AVG) en platformvoorwaarden.",
      "Gebruik commercieel CV via POST /api/commercieel-cv indien nodig.",
      "Documenteer verzonden aanbod in kandidaatnotities of pipeline.",
    ],
  };
}
