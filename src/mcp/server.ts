import { config } from "dotenv";
config({ path: ".env.local" });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Service imports ──────────────────────────────────────────────
import { searchJobs, getJobById, searchJobsByTitle } from "../services/jobs.js";
import { getAllConfigs, getHealth, updateConfig } from "../services/scrapers.js";
import {
  listCandidates,
  getCandidateById,
  searchCandidates,
  createCandidate,
} from "../services/candidates.js";
import {
  listMatches,
  getMatchById,
  updateMatchStatus,
} from "../services/matches.js";

// ── Tool definitions ─────────────────────────────────────────────

const TOOLS = [
  // Jobs
  {
    name: "list_jobs",
    description: "Lijst van vacatures ophalen, optioneel gefilterd op platform",
    inputSchema: {
      type: "object" as const,
      properties: {
        platform: { type: "string", description: "Filter op platform (bijv. 'striive', 'linkedin')" },
        limit: { type: "number", description: "Max aantal resultaten (standaard 50, max 100)" },
      },
    },
  },
  {
    name: "get_job",
    description: "Eén vacature ophalen op basis van ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Vacature-ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_jobs",
    description: "Vacatures zoeken op titel",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Zoekterm voor de vacaturetitel" },
        limit: { type: "number", description: "Max aantal resultaten (standaard 50, max 100)" },
      },
      required: ["query"],
    },
  },
  // Scrapers
  {
    name: "list_scrapers",
    description: "Alle scraper configuraties ophalen",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "scraper_health",
    description: "Gezondheidsrapport van alle scrapers (24-uurs statistieken)",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "toggle_scraper",
    description: "Scraper in- of uitschakelen",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Scraper config ID" },
        active: { type: "boolean", description: "true = inschakelen, false = uitschakelen" },
      },
      required: ["id", "active"],
    },
  },
  // Candidates
  {
    name: "list_candidates",
    description: "Lijst van kandidaten ophalen",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max aantal resultaten (standaard 50, max 100)" },
      },
    },
  },
  {
    name: "get_candidate",
    description: "Eén kandidaat ophalen op basis van ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Kandidaat-ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_candidates",
    description: "Kandidaten zoeken op naam, locatie of andere criteria",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Zoekterm (naam)" },
        location: { type: "string", description: "Locatiefilter" },
        limit: { type: "number", description: "Max aantal resultaten (standaard 50, max 100)" },
      },
    },
  },
  {
    name: "create_candidate",
    description: "Nieuwe kandidaat aanmaken",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Volledige naam" },
        email: { type: "string", description: "E-mailadres" },
        role: { type: "string", description: "Gewenste functie" },
        skills: { type: "array", items: { type: "string" }, description: "Vaardigheden" },
        location: { type: "string", description: "Locatie" },
        source: { type: "string", description: "Bron (bijv. 'mcp', 'linkedin')" },
      },
      required: ["name"],
    },
  },
  // Matches
  {
    name: "list_matches",
    description: "Lijst van matches ophalen, optioneel gefilterd",
    inputSchema: {
      type: "object" as const,
      properties: {
        jobId: { type: "string", description: "Filter op vacature-ID" },
        candidateId: { type: "string", description: "Filter op kandidaat-ID" },
        status: { type: "string", description: "Filter op status (pending, approved, rejected)" },
        limit: { type: "number", description: "Max aantal resultaten (standaard 50, max 100)" },
      },
    },
  },
  {
    name: "get_match",
    description: "Eén match ophalen met vacature- en kandidaatdetails",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Match-ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "approve_match",
    description: "Match goedkeuren",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Match-ID" },
        reviewedBy: { type: "string", description: "Naam van de reviewer" },
      },
      required: ["id"],
    },
  },
  {
    name: "reject_match",
    description: "Match afwijzen",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Match-ID" },
        reviewedBy: { type: "string", description: "Naam van de reviewer" },
      },
      required: ["id"],
    },
  },
] as const;

// ── Tool handler ─────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

async function handleTool(name: string, args: ToolInput) {
  switch (name) {
    // ── Jobs ──────────────────────────────────────────────
    case "list_jobs":
      return ok(await searchJobs({ platform: args.platform as string | undefined, limit: args.limit as number | undefined }));

    case "get_job": {
      const job = await getJobById(args.id as string);
      if (!job) return err(`Vacature met ID '${args.id}' niet gevonden`);
      return ok(job);
    }

    case "search_jobs":
      return ok(await searchJobsByTitle(args.query as string, args.limit as number | undefined));

    // ── Scrapers ─────────────────────────────────────────
    case "list_scrapers":
      return ok(await getAllConfigs());

    case "scraper_health":
      return ok(await getHealth());

    case "toggle_scraper": {
      const updated = await updateConfig(args.id as string, { isActive: args.active as boolean });
      if (!updated) return err(`Scraper met ID '${args.id}' niet gevonden`);
      return ok(updated);
    }

    // ── Candidates ───────────────────────────────────────
    case "list_candidates":
      return ok(await listCandidates(args.limit as number | undefined));

    case "get_candidate": {
      const candidate = await getCandidateById(args.id as string);
      if (!candidate) return err(`Kandidaat met ID '${args.id}' niet gevonden`);
      return ok(candidate);
    }

    case "search_candidates":
      return ok(
        await searchCandidates({
          query: args.query as string | undefined,
          location: args.location as string | undefined,
          limit: args.limit as number | undefined,
        }),
      );

    case "create_candidate":
      return ok(
        await createCandidate({
          name: args.name as string,
          email: args.email as string | undefined,
          role: args.role as string | undefined,
          skills: args.skills as string[] | undefined,
          location: args.location as string | undefined,
          source: args.source as string | undefined,
        }),
      );

    // ── Matches ──────────────────────────────────────────
    case "list_matches":
      return ok(
        await listMatches({
          jobId: args.jobId as string | undefined,
          candidateId: args.candidateId as string | undefined,
          status: args.status as string | undefined,
          limit: args.limit as number | undefined,
        }),
      );

    case "get_match": {
      const match = await getMatchById(args.id as string);
      if (!match) return err(`Match met ID '${args.id}' niet gevonden`);
      return ok(match);
    }

    case "approve_match": {
      const approved = await updateMatchStatus(args.id as string, "approved", args.reviewedBy as string | undefined);
      if (!approved) return err(`Match met ID '${args.id}' niet gevonden`);
      return ok(approved);
    }

    case "reject_match": {
      const rejected = await updateMatchStatus(args.id as string, "rejected", args.reviewedBy as string | undefined);
      if (!rejected) return err(`Match met ID '${args.id}' niet gevonden`);
      return ok(rejected);
    }

    default:
      return err(`Onbekende tool: ${name}`);
  }
}

// ── Server bootstrap ─────────────────────────────────────────────

const server = new Server(
  { name: "motian-recruitment", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleTool(name, (args ?? {}) as ToolInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Motian MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
