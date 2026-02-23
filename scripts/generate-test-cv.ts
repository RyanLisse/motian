/**
 * Generate a minimal test PDF CV for automated testing.
 * Run: pnpm tsx scripts/generate-test-cv.ts
 *
 * Creates a valid PDF with embedded text that Gemini can parse.
 * No external PDF library needed — we write raw PDF bytes.
 */
import fs from "node:fs";
import path from "node:path";

const CV_TEXT = `CURRICULUM VITAE

Naam: Pieter van den Berg
Email: pieter.vandenberg@example.com
Telefoon: +31 6 98765432
Locatie: Amsterdam

PROFIEL
Ervaren Senior Java Developer met 12 jaar ervaring in enterprise software development.
Gespecialiseerd in microservices architectuur, Spring Boot en cloud-native applicaties.

WERKERVARING

Senior Java Developer — ING Bank
2019 - heden
Ontwikkeling van core banking microservices met Spring Boot en Kubernetes.
Leiding gegeven aan een team van 6 developers.

Java Developer — Rabobank
2014 - 2019
Backend development voor het online banking platform.
Migratie van monoliet naar microservices architectuur.

Junior Developer — Ordina
2012 - 2014
Full-stack development met Java EE en Angular.

OPLEIDING
MSc Computer Science — Universiteit van Amsterdam — 2012
BSc Informatica — Universiteit van Amsterdam — 2010

VAARDIGHEDEN
Java, Spring Boot, Kubernetes, Docker, PostgreSQL, Kafka, AWS, Terraform, Git
Agile/Scrum, Team Leadership, Architecture Design

CERTIFICERINGEN
AWS Solutions Architect Associate
Oracle Certified Professional Java SE 17
Certified Kubernetes Administrator (CKA)

TALEN
Nederlands — Moedertaal
Engels — C1
Duits — B1`;

// Build a minimal valid PDF with the CV text
function buildPDF(text: string): Buffer {
  const lines = text.split("\n");
  const lineHeight = 14;
  const startY = 800;
  const margin = 50;

  // Build text drawing commands
  const textCommands = lines
    .map((line, i) => {
      const y = startY - i * lineHeight;
      if (y < 50) return null; // skip if off-page
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      return `BT /F1 10 Tf ${margin} ${y} Td (${escaped}) Tj ET`;
    })
    .filter(Boolean)
    .join("\n");

  const stream = `${textCommands}`;
  const streamLength = Buffer.byteLength(stream, "ascii");

  const objects: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function addObj(content: string) {
    offsets.push(pos);
    const obj = `${objects.length + 1} 0 obj\n${content}\nendobj\n`;
    objects.push(obj);
    pos += Buffer.byteLength(obj, "ascii");
  }

  // Header
  const header = "%PDF-1.4\n";
  pos = Buffer.byteLength(header, "ascii");

  // 1: Catalog
  addObj("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages
  addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // 3: Page
  addObj(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
  );
  // 4: Content stream
  addObj(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
  // 5: Font
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = pos + Buffer.byteLength(header, "ascii");
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map(
      (off) => `${String(off + Buffer.byteLength(header, "ascii")).padStart(10, "0")} 00000 n `,
    ),
  ].join("\n");

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(`${header + objects.join("") + xref}\n${trailer}`, "ascii");
}

const pdf = buildPDF(CV_TEXT);
const outPath = path.join(
  import.meta.dirname,
  "..",
  "tests",
  "fixtures",
  "cv",
  "pieter-vandenberg.pdf",
);
fs.writeFileSync(outPath, pdf);
console.log(`Test CV written to ${outPath} (${pdf.length} bytes)`);
