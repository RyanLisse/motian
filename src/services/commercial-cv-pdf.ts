/**
 * Converts a commercial CV markdown draft into a self-contained HTML document
 * suitable for browser print-to-PDF.
 */

type CvDraft = {
  title: string;
  body: string;
};

/**
 * Lightweight markdown-to-HTML for commercial CV bodies.
 *
 * Handles: headings (# / ##), bold (**), italic (_), unordered lists (-), hr (---).
 * Does NOT attempt to be a full markdown parser — only covers patterns
 * produced by `buildCommercialCvDraft`.
 */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push("<hr />");
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      // H1 is rendered in the branded header, skip in body
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const text = inlineFormat(line.slice(3));
      out.push(`<h2>${text}</h2>`);
      continue;
    }

    // Unordered list item
    if (/^- /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const text = inlineFormat(line.slice(2));
      out.push(`<li>${text}</li>`);
      continue;
    }

    // Close list if we hit a non-list line
    if (inList) {
      out.push("</ul>");
      inList = false;
    }

    // Empty line → skip (spacing via CSS)
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraph
    out.push(`<p>${inlineFormat(line)}</p>`);
  }

  if (inList) {
    out.push("</ul>");
  }

  return out.join("\n");
}

/** Convert inline markdown (bold, italic) to HTML. */
function inlineFormat(text: string): string {
  // Bold: **text**
  let result = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: _text_ (but not inside words like snake_case)
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
  return result;
}

/**
 * Extract candidate name and role from the markdown body.
 * The first line is `# Name`, and the role follows as `**Rol:** value`.
 */
function extractMeta(body: string): { name: string; role: string } {
  const lines = body.split("\n");
  let name = "";
  let role = "—";

  for (const line of lines) {
    if (line.startsWith("# ") && !name) {
      name = line.slice(2).trim();
    }
    const roleMatch = line.match(/\*\*Rol:\*\*\s*(.+)/);
    if (roleMatch) {
      role = roleMatch[1].trim();
    }
  }

  return { name, role };
}

/**
 * Render a commercial CV draft as a self-contained branded HTML document.
 * The output is designed for `window.print()` / browser print-to-PDF.
 */
export function renderCommercialCvHtml(draft: CvDraft): string {
  const { name, role } = extractMeta(draft.body);
  const bodyHtml = markdownToHtml(draft.body);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(draft.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a2e;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
    background: #fff;
  }

  .header {
    background: #1a1a2e;
    color: #fff;
    padding: 2rem 2.5rem;
    margin-bottom: 0;
  }

  .header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .header .role {
    font-size: 1.1rem;
    color: #a5b4fc;
    font-weight: 400;
  }

  .header .branding {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: #6b7280;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .content {
    padding: 1.5rem 2.5rem 2rem;
  }

  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 1.5rem 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 2px solid #e5e7eb;
  }

  p {
    margin: 0.5rem 0;
  }

  ul {
    margin: 0.5rem 0 0.5rem 1.25rem;
    padding: 0;
  }

  li {
    margin: 0.25rem 0;
  }

  strong {
    font-weight: 600;
  }

  em {
    font-style: italic;
    color: #6b7280;
  }

  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5rem 0;
  }

  .footer {
    text-align: center;
    padding: 1rem 2.5rem 2rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  @media print {
    body { max-width: 100%; padding: 0; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .content { padding: 1rem 2rem; }
    h2 { break-after: avoid; }
    ul, p { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(name)}</h1>
  <div class="role">${escapeHtml(role)}</div>
  <div class="branding">Motian Recruitment</div>
</div>
<div class="content">
${bodyHtml}
</div>
<div class="footer">Gegenereerd door Motian</div>
</body>
</html>`;
}

/** Basic HTML escaping for user-provided text in attributes/tags. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
