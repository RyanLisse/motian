import { generateText, Output } from "ai";
import { geminiFlash } from "../lib/ai-models";
import { withRetry } from "../lib/retry";
import {
  type ClassifiedRequirement,
  type StructuredMatchOutput,
  structuredMatchOutputSchema,
} from "../schemas/matching";

const SYSTEM_PROMPT = `Je bent een recruitment matching specialist die werkt volgens de Mariënne-methodologie.
Je evalueert een kandidaat tegen ELKE eis afzonderlijk op basis van het CV.

## Beoordelingsregels

### KNOCK-OUT criteria (tier: "knockout")
- Beoordeel met passed: true of passed: false
- stars: null (niet van toepassing)
- Citeer het EXACTE bewijs uit het CV. Als geen bewijs: "Geen bewijs gevonden in CV"
- Een knock-out die NIET voldaan is, betekent een risicovlag

### GUNNINGSCRITERIA (tier: "gunning")
- Beoordeel met stars: 1-5 (1=minimaal, 5=uitstekend)
- passed: null (niet van toepassing)
- 1 ster: Geen relevante ervaring gevonden
- 2 sterren: Minimale/indirecte ervaring
- 3 sterren: Voldoende ervaring, voldoet aan de basis
- 4 sterren: Ruime ervaring, overtreft de verwachting
- 5 sterren: Expert-niveau, uitzonderlijke match
- Citeer specifieke CV-passages als bewijs

### PROCESEISEN (tier: "process")
- passed: null, stars: null
- Noteer alleen of de informatie beschikbaar is in het CV
- confidence: altijd "medium"

## Eindbeoordeling
- overallScore: gewogen gemiddelde (0-100). Knock-outs tellen 40%, gunningscriteria 60%
- knockoutsPassed: true ALLEEN als ALLE knock-outs passed=true
- recommendation: "go" als knockoutsPassed EN overallScore >= 60
- recommendation: "no-go" als knockoutsPassed = false OF overallScore < 40
- recommendation: "conditional" in alle andere gevallen
- riskProfile: noem elk niet-voldaan knock-out criterium + gunningscriteria met 1-2 sterren
- enrichmentSuggestions: concrete acties om de match te versterken (bijscholing, certificering, etc.)

Wees eerlijk, specifiek, en consistent. Beoordeel alleen op basis van wat in het CV staat.`;

export async function runStructuredMatch(input: {
  requirements: ClassifiedRequirement[];
  candidateName: string;
  cvText: string;
}): Promise<StructuredMatchOutput> {
  if (input.requirements.length === 0) {
    throw new Error("Requirements list is empty — cannot run structured match without criteria.");
  }

  if (input.cvText.length < 50) {
    throw new Error(
      `CV text is too short (${input.cvText.length} chars). Minimum 50 characters required for meaningful evaluation.`,
    );
  }

  const prompt = `## Kandidaat: ${input.candidateName}\n\n## CV:\n${input.cvText}\n\n## Te beoordelen eisen:\n${JSON.stringify(input.requirements, null, 2)}`;

  const { output } = await withRetry(
    () =>
      generateText({
        model: geminiFlash,
        output: Output.object({ schema: structuredMatchOutputSchema }),
        system: SYSTEM_PROMPT,
        prompt,
        providerOptions: { google: { structuredOutputs: true } },
      }),
    { label: "Structured Matching" },
  );

  return output as StructuredMatchOutput;
}
