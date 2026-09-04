/**
 * Markdown.fast integration — publish, retrieve, and revoke match reports.
 * Local fallback returns `/reports/<matchId>`; the page regenerates from the match record
 * (no in-process store — survives serverless instance boundaries).
 */

const MARKDOWN_FAST_BASE = process.env.MARKDOWN_FAST_URL ?? "https://api.markdown.fast";
const MARKDOWN_FAST_TOKEN = process.env.MARKDOWN_FAST_TOKEN;

interface PublishResult {
  url: string;
  id: string;
  source: "markdown.fast" | "local";
}

/**
 * Publish a markdown report to markdown.fast or fall back to a durable local URL.
 * Local fallback uses `matchId` so any instance can regenerate via `/reports/<matchId>`.
 */
export async function publishReport(
  markdown: string,
  title: string,
  matchId: string,
): Promise<PublishResult> {
  // Try markdown.fast first if configured
  if (MARKDOWN_FAST_TOKEN) {
    try {
      const res = await fetch(`${MARKDOWN_FAST_BASE}/api/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MARKDOWN_FAST_TOKEN}`,
        },
        body: JSON.stringify({ content: markdown, title }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          url: data.url,
          id: data.id,
          source: "markdown.fast",
        };
      }
      console.warn("[Markdown.fast] Publish failed, falling back to local:", res.status);
    } catch (err) {
      console.warn("[Markdown.fast] Unavailable, falling back to local:", err);
    }
  }

  // Durable local URL: page regenerates from matchId (no in-process Map)
  return {
    url: `/reports/${matchId}`,
    id: matchId,
    source: "local",
  };
}

/**
 * Retrieve a report by ID from markdown.fast (external publishes only).
 * Local reports are not stored — resolve via `/reports/<matchId>` + generateReport.
 */
export async function getReport(id: string): Promise<string | null> {
  if (!MARKDOWN_FAST_TOKEN) {
    return null;
  }

  try {
    const res = await fetch(`${MARKDOWN_FAST_BASE}/api/reports/${id}`, {
      headers: { Authorization: `Bearer ${MARKDOWN_FAST_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content ?? null;
    }
  } catch {
    // External lookup failed
  }

  return null;
}

/**
 * Revoke (delete) a published report on markdown.fast.
 *
 * RESIDUAL (WP5): no production callers. External DELETE only when MARKDOWN_FAST_TOKEN
 * is set. Local reports regenerate from matchId — candidate/match erasure removes the
 * source. Wiring into GDPR Art.17 eraseCandidateData is a product decision (owner:
 * recruiting). Do not delete this export until that decision lands.
 */
export async function revokeReport(id: string): Promise<void> {
  if (!MARKDOWN_FAST_TOKEN) {
    return;
  }

  try {
    await fetch(`${MARKDOWN_FAST_BASE}/api/reports/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MARKDOWN_FAST_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort
  }
}
