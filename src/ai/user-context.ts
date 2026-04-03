import { chatSessionMessages, db, desc, eq } from "@/src/db";

export type UserContext = {
  userId: string;
  sessionTurnCount: number;
  recentJobIds: string[];
  recentCandidateIds: string[];
  contextType: "session" | "anonymous";
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MAX_MESSAGES = 10;

function extractUuids(text: string): string[] {
  return [...new Set(text.match(UUID_RE) ?? [])];
}

/** Heuristic: an ID mentioned alongside "kandidaat" context words is a candidate ID. */
function partitionIds(
  uuids: string[],
  rawTexts: string[],
): { jobIds: string[]; candidateIds: string[] } {
  const combined = rawTexts.join(" ").toLowerCase();
  const candidateIds: string[] = [];
  const jobIds: string[] = [];

  for (const uuid of uuids) {
    const idx = combined.indexOf(uuid.toLowerCase());
    const surroundStart = Math.max(0, idx - 60);
    const surroundEnd = Math.min(combined.length, idx + 60);
    const surrounding = combined.slice(surroundStart, surroundEnd);

    const isCandidate =
      surrounding.includes("kandidaat") ||
      surrounding.includes("kandidaten") ||
      surrounding.includes("candidate");

    if (isCandidate) {
      candidateIds.push(uuid);
    } else {
      jobIds.push(uuid);
    }
  }

  return { jobIds, candidateIds };
}

/**
 * Extract user-scoped context from recent chat messages for the given session.
 * Returns entity references (job IDs, candidate IDs) and session metadata.
 * Always succeeds — returns an empty context on any error.
 */
export async function getUserContext(sessionId: string): Promise<UserContext> {
  const fallback: UserContext = {
    userId: "anonymous",
    sessionTurnCount: 0,
    recentJobIds: [],
    recentCandidateIds: [],
    contextType: "anonymous",
  };

  if (!sessionId) return fallback;

  try {
    const rows = await db
      .select({
        role: chatSessionMessages.role,
        message: chatSessionMessages.message,
        orderIndex: chatSessionMessages.orderIndex,
      })
      .from(chatSessionMessages)
      .where(eq(chatSessionMessages.sessionId, sessionId))
      .orderBy(desc(chatSessionMessages.orderIndex))
      .limit(MAX_MESSAGES);

    if (rows.length === 0) return fallback;

    const userTurns = rows.filter((r) => r.role === "user");
    const rawTexts = userTurns
      .map((r) => {
        const msg = r.message as { content?: unknown };
        if (typeof msg?.content === "string") return msg.content;
        if (Array.isArray(msg?.content)) {
          return msg.content
            .map((part: unknown) => {
              if (typeof part === "string") return part;
              if (typeof part === "object" && part !== null && "text" in part) {
                return (part as { text: unknown }).text;
              }
              return "";
            })
            .join(" ");
        }
        return JSON.stringify(msg);
      })
      .filter(Boolean);

    const allUuids = extractUuids(rawTexts.join(" "));
    const { jobIds, candidateIds } = partitionIds(allUuids, rawTexts);

    const turnCount = Math.max(...rows.map((r) => r.orderIndex)) + 1;

    return {
      userId: "anonymous",
      sessionTurnCount: turnCount,
      recentJobIds: jobIds.slice(0, 5),
      recentCandidateIds: candidateIds.slice(0, 5),
      contextType: "session",
    };
  } catch {
    return fallback;
  }
}
