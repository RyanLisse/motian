import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMatchReport } from "@/src/services/report-helpers";

export const metadata: Metadata = {
  title: "Beoordelingsrapport",
  description: "Matchrapport gegenereerd door Motian Recruitment Platform",
};

interface Props {
  params: Promise<{ id: string }>;
}

const REPORT_CSS = `
@media print {
  body { font-size: 11pt; }
  .no-print { display: none; }
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  color: #1a1a1a;
  line-height: 1.6;
}
h1 { font-size: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1rem; }
h2 { font-size: 1.15rem; color: #374151; margin-top: 1.5rem; margin-bottom: 0.75rem; }
table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; }
tr:nth-child(odd) { background: #f9fafb; }
ul, ol { padding-left: 1.5rem; margin: 0.5rem 0; }
li { margin: 0.25rem 0; font-size: 0.9rem; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
p { margin: 0.4rem 0; }
em { color: #6b7280; font-size: 0.85rem; }
strong { color: #111827; }
`;

/** Escape text fragments before HTML assembly — DB/AI fields are untrusted. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Simple markdown-to-HTML: headings, bold, italic, tables, lists, hr.
 * Escapes every text fragment before tags; applies `**`/`*` after escaping.
 */
export function markdownToHtml(md: string): string {
  return (
    md
      .split("\n")
      .map((line) => {
        // Headings
        if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
        if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;

        // Horizontal rule
        if (line.trim() === "---") return "<hr />";

        // Table rows
        if (line.startsWith("|")) {
          // Skip separator rows
          if (/^\|[-| ]+\|$/.test(line.trim())) return "";
          const cells = line
            .split("|")
            .filter(Boolean)
            .map((c) => escapeHtml(c.trim()));
          const tag = "td";
          return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
        }

        // Ordered list
        const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) return `<li>${escapeHtml(olMatch[2] ?? "")}</li>`;

        // Unordered list
        if (line.startsWith("- ")) return `<li>${escapeHtml(line.slice(2))}</li>`;

        // Blank line
        if (line.trim() === "") return "";

        // Paragraph
        return `<p>${escapeHtml(line)}</p>`;
      })
      .join("\n")
      // Inline formatting after escape so emphasis still works
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Wrap table rows in table
      .replace(/((?:<tr>.*<\/tr>\n?)+)/g, "<table>$1</table>")
      // Wrap consecutive li in ul
      .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
  );
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  // Local publish URLs are matchIds — regenerate deterministically (R14)
  const result = await fetchMatchReport(id);

  if (!result.ok) {
    notFound();
  }

  const html = markdownToHtml(result.markdown);

  return (
    <html lang="nl">
      <head>
        <style>{REPORT_CSS}</style>
      </head>
      <body>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: fragments escaped via escapeHtml before assembly */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </body>
    </html>
  );
}
