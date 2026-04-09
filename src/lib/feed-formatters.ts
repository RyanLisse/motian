/**
 * Feed formatters for vacancy distribution to Indeed, Google Jobs, etc.
 */

const BASE_URL = "https://motian.vercel.app";

export type FeedJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  platform: string;
  postedAt: Date | null;
  externalUrl?: string | null;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(name: string, value: string | null | undefined): string {
  if (value == null || value === "") return `    <${name} />`;
  return `    <${name}>${escapeXml(value)}</${name}>`;
}

export function toJobXml(jobs: FeedJob[]): string {
  const items = jobs
    .map(
      (j) => `  <job>
${xmlTag("id", j.id)}
${xmlTag("title", j.title)}
${xmlTag("company", j.company)}
${xmlTag("location", j.location)}
${xmlTag("url", `${BASE_URL}/vacatures/${j.id}`)}
${xmlTag("description", j.description)}
${xmlTag("platform", j.platform)}
${xmlTag("postedAt", j.postedAt?.toISOString() ?? null)}
  </job>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<jobs>
${items}
</jobs>`;
}

export function toJobRss(jobs: FeedJob[]): string {
  const items = jobs
    .map(
      (j) => `    <item>
      <title>${escapeXml(j.title)}</title>
      <link>${BASE_URL}/vacatures/${j.id}</link>
      <description>${escapeXml(j.description ?? "")}</description>
      <guid>${j.id}</guid>
${j.postedAt ? `      <pubDate>${j.postedAt.toUTCString()}</pubDate>` : ""}
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Motian Vacatures Feed</title>
    <link>${BASE_URL}/vacatures</link>
    <description>Actuele vacatures van het Motian platform</description>
    <language>nl</language>
${items}
  </channel>
</rss>`;
}
