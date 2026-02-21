import { getModel, getOAuthApiKey } from "@mariozechner/pi-ai";
import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────

export interface MatchResult {
  overallScore: number;
  knockOutCriteria: {
    criterion: string;
    required: boolean;
    met: boolean;
    evidence: string;
  }[];
  scoringCriteria: {
    criterion: string;
    weight: number;
    score: number;
    explanation: string;
  }[];
  riskLevel: "Laag" | "Gemiddeld" | "Hoog";
  riskExplanation: string;
  recommendations: string[];
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
}

export interface AIModelConfig {
  model: ReturnType<typeof getModel>;
  provider: string;
  apiKey: string | undefined;
}

// ── AI Model Resolution ─────────────────────────────────

const AUTH_PATH = join(process.cwd(), "auth.json");

/**
 * Resolve an AI model using OAuth (subscription) or API key fallback.
 * Returns null if no credentials are configured.
 */
export async function getAIModel(): Promise<AIModelConfig | null> {
  // 1. Try OAuth (subscription)
  if (existsSync(AUTH_PATH)) {
    try {
      const auth = JSON.parse(
        readFileSync(AUTH_PATH, "utf-8"),
      ) as Record<string, OAuthCredentials>;
      if (auth.anthropic) {
        const result = await getOAuthApiKey("anthropic", auth);
        if (result) {
          auth.anthropic = result.newCredentials;
          writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
          return {
            model: getModel("anthropic", "claude-sonnet-4-6"),
            provider: "anthropic-oauth",
            apiKey: result.apiKey,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }
  // 2. API keys
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      model: getModel("anthropic", "claude-sonnet-4-6"),
      provider: "anthropic",
      apiKey: undefined,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      model: getModel("openai", "gpt-5"),
      provider: "openai",
      apiKey: undefined,
    };
  }
  return null;
}
