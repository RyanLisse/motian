/**
 * Markdown.fast integration — publish, retrieve, and revoke match reports.
 * Falls back to local storage when markdown.fast is unavailable.
 */

const MARKDOWN_FAST_BASE = process.env.MARKDOWN_FAST_URL ?? "https://api.markdown.fast";
const MARKDOWN_FAST_TOKEN = process.env.MARKDOWN_FAST_TOKEN;

interface PublishResult {
  url: string;
  id: string;
  source: "markdown.fast" | "local";
}

/**
 * Publish a markdown report to markdown.fast or fall back to local storage.
 */
export async function publishReport(markdown: string, title: string): Promise<PublishResult> {
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

  // Fallback: generate a local report ID and serve from /api/reports/[id]
  const id = generateReportId();
  // Store in-memory (in production, use a database or KV store)
  reportStore.set(id, { markdown, title, createdAt: new Date() });

  return {
    url: `/api/reports/${id}`,
    id,
    source: "local",
  };
}

/**
 * Retrieve a report by ID (from markdown.fast or local store).
 */
export async function getReport(id: string): Promise<string | null> {
  // Try markdown.fast first
  if (MARKDOWN_FAST_TOKEN) {
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
      // Fall through to local
    }
  }

  // Local fallback
  const local = reportStore.get(id);
  return local?.markdown ?? null;
}

/**
 * Revoke (delete) a published report.
 */
export async function revokeReport(id: string): Promise<void> {
  if (MARKDOWN_FAST_TOKEN) {
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

  // Always clean local store
  reportStore.delete(id);
}

// ── Local fallback store ──

interface StoredReport {
  markdown: string;
  title: string;
  createdAt: Date;
}

const reportStore = new Map<string, StoredReport>();

function generateReportId(): string {
  return `rpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get all locally stored reports (for listing/admin purposes).
 */
export function listLocalReports(): Array<{
  id: string;
  title: string;
  createdAt: Date;
}> {
  return Array.from(reportStore.entries()).map(([id, r]) => ({
    id,
    title: r.title,
    createdAt: r.createdAt,
  }));
}
