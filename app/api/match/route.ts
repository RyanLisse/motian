import { NextRequest, NextResponse } from "next/server"
import { getModel, complete, getOAuthApiKey } from "@mariozechner/pi-ai"
import type { OAuthCredentials } from "@mariozechner/pi-ai"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

interface MatchResult {
  overallScore: number
  knockOutCriteria: { criterion: string; required: boolean; met: boolean; evidence: string }[]
  scoringCriteria: { criterion: string; weight: number; score: number; explanation: string }[]
  riskLevel: "Laag" | "Gemiddeld" | "Hoog"
  riskExplanation: string
  recommendations: string[]
  matchedSkills: string[]
  missingSkills: string[]
  summary: string
}

const AUTH_PATH = join(process.cwd(), "auth.json")

async function getAIModel() {
  // 1. Try OAuth (subscription)
  if (existsSync(AUTH_PATH)) {
    try {
      const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as Record<string, OAuthCredentials>
      if (auth.anthropic) {
        const result = await getOAuthApiKey("anthropic", auth)
        if (result) {
          auth.anthropic = result.newCredentials
          writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2))
          return { model: getModel("anthropic", "claude-sonnet-4-6"), provider: "anthropic-oauth", apiKey: result.apiKey }
        }
      }
    } catch { /* fall through */ }
  }
  // 2. API keys
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: getModel("anthropic", "claude-sonnet-4-6"), provider: "anthropic", apiKey: undefined }
  }
  if (process.env.OPENAI_API_KEY) {
    return { model: getModel("openai", "gpt-5"), provider: "openai", apiKey: undefined }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { candidate, job } = await req.json()

    if (!candidate || !job) {
      return NextResponse.json(
        { error: "Kandidaat en opdracht zijn vereist" },
        { status: 400 }
      )
    }

    const ai = await getAIModel()
    if (!ai) {
      return NextResponse.json(
        { error: "NO_API_KEY", message: "Geen credentials geconfigureerd. Run: npx @mariozechner/pi-ai login anthropic" },
        { status: 503 }
      )
    }

    const prompt = `Je bent een expert recruitment AI die kandidaten matcht aan opdrachten voor een Nederlands recruitmentbureau (Motian).

Analyseer de volgende kandidaat en opdracht en geef een gedetailleerd match rapport.

## Kandidaat
- Naam: ${candidate.name}
- Rol: ${candidate.role}
- Ervaring: ${candidate.experience}
- Locatie: ${candidate.location}
- Skills: ${candidate.skills.join(", ")}
- AI Score: ${candidate.score}/100
- Skill Match: ${candidate.skillMatch}%
- Relevantie: ${candidate.relevance}%
- CV Kwaliteit: ${candidate.resumeQuality}%
- Tags: ${candidate.tags?.join(", ") || "geen"}

## Opdracht
- Titel: ${job.title}
- Afdeling: ${job.department}
- Locatie: ${job.location}
- Type: ${job.type}
- Vereiste Skills: ${job.requiredSkills.join(", ")}
- Aantal sollicitanten: ${job.applicants}

## Instructies
1. Evalueer knock-out criteria (harde vereisten: minimaal 3 jaar ervaring, elke vereiste skill, locatie compatibiliteit)
2. Score op 5 dimensies: Technische Skills (30%), Ervaring (25%), Probleemoplossend vermogen (20%), Communicatie (15%), Culturele Fit (10%)
3. Bereken een overall score (0-100) gebaseerd op gewogen scores
4. Bepaal risicoprofiel (Laag/Gemiddeld/Hoog)
5. Geef 3 concrete aanbevelingen in het Nederlands
6. Schrijf een korte samenvatting in het Nederlands

Wees realistisch en eerlijk in je beoordeling. Gebruik bewijs uit het kandidaatprofiel.

Antwoord ALLEEN met een geldig JSON object in exact dit formaat (geen markdown, geen uitleg, alleen JSON):
{
  "overallScore": <number 0-100>,
  "knockOutCriteria": [{"criterion": "...", "required": true/false, "met": true/false, "evidence": "..."}],
  "scoringCriteria": [{"criterion": "...", "weight": <number>, "score": <number 1-5>, "explanation": "..."}],
  "riskLevel": "Laag" | "Gemiddeld" | "Hoog",
  "riskExplanation": "...",
  "recommendations": ["...", "...", "..."],
  "matchedSkills": ["...", "..."],
  "missingSkills": ["...", "..."],
  "summary": "..."
}`

    const response = await complete(ai.model, {
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    }, {
      maxTokens: 4096,
      temperature: 0.3,
      ...(ai.apiKey ? { apiKey: ai.apiKey } : {}),
    })

    // Extract text from response content
    const text = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("")

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim()
    const result: MatchResult = JSON.parse(jsonStr)

    return NextResponse.json({ success: true, result, provider: ai.provider })
  } catch (error: unknown) {
    console.error("Match API error:", error)
    const message = error instanceof Error ? error.message : "Onbekende fout"
    return NextResponse.json(
      { error: "MATCH_FAILED", message },
      { status: 500 }
    )
  }
}
