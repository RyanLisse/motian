import { NextRequest } from "next/server"
import { getModel, complete, getOAuthApiKey } from "@mariozechner/pi-ai"
import { Type } from "@sinclair/typebox"
import type { Api, Model, Tool, ToolResultMessage, Message, AssistantMessage, OAuthCredentials } from "@mariozechner/pi-ai"
import { candidates, positionsList, interviews, messages as messageItems, pipelineStages } from "@/lib/data"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

// ── Auth file path ──────────────────────────────────

const AUTH_PATH = join(process.cwd(), "auth.json")

// ── Provider detection with OAuth support ───────────

async function getAIModelWithKey(): Promise<{ model: Model<Api>; apiKey?: string } | null> {
  // 1. Try OAuth credentials (subscription-based — free with Pro/Max)
  if (existsSync(AUTH_PATH)) {
    try {
      const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as Record<string, OAuthCredentials>

      if (auth.anthropic) {
        const result = await getOAuthApiKey("anthropic", auth)
        if (result) {
          // Persist refreshed credentials
          auth.anthropic = result.newCredentials
          writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2))
          return { model: getModel("anthropic", "claude-sonnet-4-6") as Model<Api>, apiKey: result.apiKey }
        }
      }
    } catch (e) {
      console.warn("OAuth credential load failed, falling back to env keys:", e)
    }
  }

  // 2. Fall back to API keys from environment
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: getModel("anthropic", "claude-sonnet-4-6") as Model<Api> }
  }
  if (process.env.OPENAI_API_KEY) {
    return { model: getModel("openai", "gpt-5") as Model<Api> }
  }
  return null
}

// ── Tool definitions (TypeBox schemas) ──────────────

const tools: Tool[] = [
  {
    name: "search_candidates",
    description: "Zoek en filter kandidaten op skills, locatie, status, of minimale score. Geeft een lijst van kandidaten terug.",
    parameters: Type.Object({
      skills: Type.Optional(Type.Array(Type.String(), { description: "Filter op skills (bijv. ['React', 'Python'])" })),
      location: Type.Optional(Type.String({ description: "Filter op locatie (bijv. 'Amsterdam')" })),
      status: Type.Optional(Type.String({ description: "Filter op status: new, screening, interview, offer, hired, rejected" })),
      minScore: Type.Optional(Type.Number({ description: "Minimale AI score (0-100)" })),
      query: Type.Optional(Type.String({ description: "Vrije zoekterm op naam of rol" })),
    }),
  },
  {
    name: "search_jobs",
    description: "Zoek openstaande opdrachten/vacatures. Filter op afdeling, locatie, of vereiste skills.",
    parameters: Type.Object({
      department: Type.Optional(Type.String({ description: "Filter op afdeling (bijv. 'Engineering')" })),
      location: Type.Optional(Type.String({ description: "Filter op locatie" })),
      skills: Type.Optional(Type.Array(Type.String(), { description: "Filter op vereiste skills" })),
      query: Type.Optional(Type.String({ description: "Vrije zoekterm op titel" })),
    }),
  },
  {
    name: "get_candidate_details",
    description: "Haal alle details op van een specifieke kandidaat op basis van naam of ID.",
    parameters: Type.Object({
      candidateId: Type.Optional(Type.String({ description: "Kandidaat ID (bijv. 'c1')" })),
      name: Type.Optional(Type.String({ description: "Kandidaat naam (bijv. 'Jan de Vries')" })),
    }),
  },
  {
    name: "get_job_details",
    description: "Haal alle details op van een specifieke opdracht op basis van titel of ID.",
    parameters: Type.Object({
      jobId: Type.Optional(Type.String({ description: "Opdracht ID (bijv. 'j1')" })),
      title: Type.Optional(Type.String({ description: "Opdracht titel" })),
    }),
  },
  {
    name: "match_candidate_to_job",
    description: "Analyseer hoe goed een kandidaat past bij een opdracht. Geeft een score en analyse terug.",
    parameters: Type.Object({
      candidateId: Type.String({ description: "Kandidaat ID" }),
      jobId: Type.String({ description: "Opdracht ID" }),
    }),
  },
  {
    name: "update_candidate_status",
    description: "Verplaats een kandidaat naar een andere pipeline fase (bijv. van 'screening' naar 'interview').",
    parameters: Type.Object({
      candidateId: Type.String({ description: "Kandidaat ID" }),
      newStatus: Type.String({ description: "Nieuwe status: new, screening, interview, offer, hired, rejected" }),
    }),
  },
  {
    name: "schedule_interview",
    description: "Plan een gesprek/interview in met een kandidaat.",
    parameters: Type.Object({
      candidateId: Type.String({ description: "Kandidaat ID" }),
      date: Type.String({ description: "Datum (YYYY-MM-DD)" }),
      time: Type.String({ description: "Tijd (HH:MM)" }),
      type: Type.String({ description: "Type: phone, video, onsite, technical" }),
      interviewer: Type.String({ description: "Naam van de interviewer" }),
    }),
  },
  {
    name: "send_message",
    description: "Stuur een bericht/e-mail naar kandidaten.",
    parameters: Type.Object({
      subject: Type.String({ description: "Onderwerp van het bericht" }),
      recipients: Type.String({ description: "Kandidaat naam/namen of 'all'" }),
      template: Type.Optional(Type.String({ description: "Template type: Onboarding, Interview, Status Update, Aanbieding" })),
    }),
  },
  {
    name: "get_pipeline_overview",
    description: "Geeft een overzicht van de recruitment pipeline: hoeveel kandidaten in elke fase.",
    parameters: Type.Object({}),
  },
  {
    name: "get_platform_stats",
    description: "Geeft platform statistieken: totaal kandidaten, actieve opdrachten, geplande interviews, berichten.",
    parameters: Type.Object({}),
  },
]

// ── Tool execution ──────────────────────────────────

function executeTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "search_candidates": {
      let results = [...candidates]
      if (args.skills && Array.isArray(args.skills)) {
        const skillFilter = (args.skills as string[]).map(s => s.toLowerCase())
        results = results.filter(c => c.skills.some(s => skillFilter.some(f => s.toLowerCase().includes(f))))
      }
      if (args.location) {
        results = results.filter(c => c.location.toLowerCase().includes((args.location as string).toLowerCase()))
      }
      if (args.status) {
        results = results.filter(c => c.status === args.status)
      }
      if (args.minScore) {
        results = results.filter(c => c.score >= (args.minScore as number))
      }
      if (args.query) {
        const q = (args.query as string).toLowerCase()
        results = results.filter(c => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q))
      }
      return JSON.stringify(results.map(c => ({
        id: c.id, name: c.name, role: c.role, score: c.score,
        skills: c.skills, location: c.location, status: c.status,
        experience: c.experience, skillMatch: c.skillMatch,
      })))
    }

    case "search_jobs": {
      let results = [...positionsList].filter(j => j.status === "active")
      if (args.department) {
        results = results.filter(j => j.department.toLowerCase().includes((args.department as string).toLowerCase()))
      }
      if (args.location) {
        results = results.filter(j => j.location.toLowerCase().includes((args.location as string).toLowerCase()))
      }
      if (args.skills && Array.isArray(args.skills)) {
        const skillFilter = (args.skills as string[]).map(s => s.toLowerCase())
        results = results.filter(j => j.requiredSkills.some(s => skillFilter.some(f => s.toLowerCase().includes(f))))
      }
      if (args.query) {
        const q = (args.query as string).toLowerCase()
        results = results.filter(j => j.title.toLowerCase().includes(q))
      }
      return JSON.stringify(results)
    }

    case "get_candidate_details": {
      const c = candidates.find(c =>
        c.id === args.candidateId ||
        c.name.toLowerCase().includes(((args.name as string) || "").toLowerCase())
      )
      if (!c) return JSON.stringify({ error: "Kandidaat niet gevonden" })
      const ints = interviews.filter(i => i.candidateId === c.id)
      return JSON.stringify({ ...c, interviews: ints })
    }

    case "get_job_details": {
      const j = positionsList.find(j =>
        j.id === args.jobId ||
        j.title.toLowerCase().includes(((args.title as string) || "").toLowerCase())
      )
      if (!j) return JSON.stringify({ error: "Opdracht niet gevonden" })
      const matchedCandidates = candidates.filter(c =>
        c.skills.some(s => j.requiredSkills.some(r => s.toLowerCase().includes(r.toLowerCase())))
      ).map(c => ({ id: c.id, name: c.name, score: c.score, skillMatch: c.skillMatch }))
      return JSON.stringify({ ...j, potentialCandidates: matchedCandidates })
    }

    case "match_candidate_to_job": {
      const c = candidates.find(c => c.id === args.candidateId)
      const j = positionsList.find(j => j.id === args.jobId)
      if (!c || !j) return JSON.stringify({ error: "Kandidaat of opdracht niet gevonden" })

      const matched = c.skills.filter(s => j.requiredSkills.some(r => s.toLowerCase().includes(r.toLowerCase())))
      const missing = j.requiredSkills.filter(r => !c.skills.some(s => s.toLowerCase().includes(r.toLowerCase())))
      const skillScore = j.requiredSkills.length > 0 ? (matched.length / j.requiredSkills.length) * 100 : 0
      const locationMatch = c.location.toLowerCase() === j.location.toLowerCase()
      const overallScore = Math.round(skillScore * 0.5 + c.score * 0.3 + (locationMatch ? 20 : 5))

      return JSON.stringify({
        candidate: c.name, job: j.title, overallScore: Math.min(overallScore, 100),
        matchedSkills: matched, missingSkills: missing,
        locationMatch, candidateScore: c.score,
        recommendation: overallScore >= 80 ? "Sterk aanbevolen" : overallScore >= 60 ? "Geschikt" : "Beperkte match",
      })
    }

    case "update_candidate_status": {
      const c = candidates.find(c => c.id === args.candidateId)
      if (!c) return JSON.stringify({ error: "Kandidaat niet gevonden" })
      const oldStatus = c.status
      const validStatuses = ["new", "screening", "interview", "offer", "hired", "rejected"]
      if (!validStatuses.includes(args.newStatus as string)) {
        return JSON.stringify({ error: `Ongeldige status. Kies uit: ${validStatuses.join(", ")}` })
      }
      return JSON.stringify({
        success: true, candidate: c.name,
        oldStatus, newStatus: args.newStatus,
        message: `${c.name} verplaatst van '${oldStatus}' naar '${args.newStatus}'`,
      })
    }

    case "schedule_interview": {
      const c = candidates.find(c => c.id === args.candidateId)
      if (!c) return JSON.stringify({ error: "Kandidaat niet gevonden" })
      return JSON.stringify({
        success: true,
        interview: {
          candidateName: c.name, role: c.role,
          date: args.date, time: args.time,
          type: args.type, interviewer: args.interviewer,
          status: "scheduled",
        },
        message: `Interview gepland met ${c.name} op ${args.date} om ${args.time}`,
      })
    }

    case "send_message": {
      return JSON.stringify({
        success: true,
        message: `Bericht '${args.subject}' verstuurd naar ${args.recipients}`,
        template: args.template || "Geen template",
        status: "sent",
      })
    }

    case "get_pipeline_overview": {
      const overview = pipelineStages.map(stage => ({
        stage: stage.name,
        count: candidates.filter(c => c.status === stage.id).length,
        candidates: candidates.filter(c => c.status === stage.id).map(c => c.name),
      }))
      const rejected = candidates.filter(c => c.status === "rejected")
      return JSON.stringify({
        stages: overview,
        rejected: { count: rejected.length, candidates: rejected.map(c => c.name) },
        total: candidates.length,
      })
    }

    case "get_platform_stats": {
      return JSON.stringify({
        totalCandidates: candidates.length,
        activeJobs: positionsList.filter(j => j.status === "active").length,
        scheduledInterviews: interviews.filter(i => i.status === "scheduled").length,
        completedInterviews: interviews.filter(i => i.status === "completed").length,
        messagesSent: messageItems.filter(m => m.status === "sent").length,
        averageScore: Math.round(candidates.reduce((s, c) => s + c.score, 0) / candidates.length),
        topCandidate: candidates.reduce((a, b) => a.score > b.score ? a : b).name,
        pipelineBreakdown: {
          new: candidates.filter(c => c.status === "new").length,
          screening: candidates.filter(c => c.status === "screening").length,
          interview: candidates.filter(c => c.status === "interview").length,
          offer: candidates.filter(c => c.status === "offer").length,
          hired: candidates.filter(c => c.status === "hired").length,
        },
      })
    }

    default:
      return JSON.stringify({ error: `Onbekende tool: ${name}` })
  }
}

// ── System prompt ───────────────────────────────────

const SYSTEM_PROMPT = `Je bent de AI-assistent van Motian, een Nederlands recruitmentbureau. Je hebt volledige toegang tot het platform en kunt alles doen wat een recruiter kan.

Je beschikbare acties:
- Kandidaten zoeken en filteren op skills, locatie, score
- Opdrachten/vacatures doorzoeken
- Kandidaat-details opvragen inclusief interview historie
- Kandidaten matchen aan opdrachten met score-analyse
- Kandidaten verplaatsen in de pipeline (status wijzigen)
- Interviews inplannen
- Berichten versturen naar kandidaten
- Pipeline en platform statistieken bekijken

Regels:
1. Antwoord altijd in het Nederlands
2. Gebruik je tools actief — zoek data op in plaats van te gissen
3. Wees concreet: noem namen, scores, data
4. Bij matching: geef altijd de matchscore en gematchte/missende skills
5. Bij acties (status wijzigen, interview plannen): bevestig wat je hebt gedaan
6. Houd antwoorden bondig maar informatief
7. Als je meerdere tools nodig hebt, gebruik ze allemaal`

// ── Agent loop ──────────────────────────────────────

const MAX_TOOL_ROUNDS = 5

export async function POST(req: NextRequest) {
  const ai = await getAIModelWithKey()
  if (!ai) {
    return new Response(
      JSON.stringify({ error: "NO_API_KEY", message: "Geen API key of OAuth credentials geconfigureerd. Run: npx @mariozechner/pi-ai login anthropic" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  const { model, apiKey } = ai
  const { messages: chatHistory } = await req.json()

  // Build pi-ai message context from chat history
  const piMessages: Message[] = (chatHistory as { role: string; content: string }[]).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.role === "user"
      ? m.content
      : [{ type: "text" as const, text: m.content }],
    timestamp: Date.now(),
  })) as Message[]

  // Create a ReadableStream for streaming the response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...piMessages]
        let rounds = 0

        while (rounds < MAX_TOOL_ROUNDS) {
          rounds++

          const response: AssistantMessage = await complete(model, {
            systemPrompt: SYSTEM_PROMPT,
            messages: currentMessages,
            tools,
          }, {
            maxTokens: 4096,
            temperature: 0.3,
            ...(apiKey ? { apiKey } : {}),
          })

          // Check if there are tool calls
          const toolCalls = response.content.filter(c => c.type === "toolCall")

          if (toolCalls.length === 0) {
            // No tool calls — stream the final text response
            const text = response.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map(c => c.text)
              .join("")

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`))
            break
          }

          // Execute tool calls and send updates
          const toolResults: ToolResultMessage[] = []

          for (const tc of toolCalls) {
            if (tc.type !== "toolCall") continue

            // Stream tool usage to client
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "tool_use", tool: tc.name, args: tc.arguments })}\n\n`
            ))

            const result = executeTool(tc.name, tc.arguments)

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "tool_result", tool: tc.name, result: JSON.parse(result) })}\n\n`
            ))

            toolResults.push({
              role: "toolResult",
              toolCallId: tc.id,
              toolName: tc.name,
              content: [{ type: "text", text: result }],
              isError: false,
              timestamp: Date.now(),
            })
          }

          // Add assistant message and tool results to context for next round
          currentMessages = [...currentMessages, response, ...toolResults]
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout"
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message })}\n\n`
        ))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
