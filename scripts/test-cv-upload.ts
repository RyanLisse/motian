/**
 * Integration test for the CV upload pipeline.
 * Requires the dev server running on localhost:3001.
 *
 * Usage:
 *   pnpm tsx scripts/test-cv-upload.ts                          # default fixture
 *   pnpm tsx scripts/test-cv-upload.ts path/to/custom.pdf       # custom PDF
 *   pnpm tsx scripts/test-cv-upload.ts --all                    # test all fixtures
 *
 * What it tests:
 *   1. Upload + parse: POST /api/cv-upload → Vercel Blob + Gemini parsing
 *   2. Schema validation: parsed result matches parsedCVSchema
 *   3. Save: POST /api/cv-upload/save → candidate created in DB
 *   4. Cleanup: DELETE /api/kandidaten/:id → soft-delete the test candidate
 */
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const FIXTURES_DIR = path.join(import.meta.dirname, "..", "tests", "fixtures", "cv");
const DEFAULT_FIXTURE = path.join(FIXTURES_DIR, "pieter-vandenberg.pdf");

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function testFile(filePath: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const fileName = path.basename(filePath);
  console.log(`\n${bold(`Testing: ${fileName}`)}`);
  console.log(dim("─".repeat(50)));

  // Read file
  if (!fs.existsSync(filePath)) {
    return [
      { name: `${fileName}: file exists`, passed: false, duration: 0, error: "File not found" },
    ];
  }

  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: "application/pdf" });

  // Step 1: Upload + Parse
  let parsed: Record<string, unknown> | null = null;
  let fileUrl: string | null = null;

  const t1 = Date.now();
  try {
    const formData = new FormData();
    formData.append("cv", blob, fileName);

    const res = await fetch(`${BASE_URL}/api/cv-upload`, {
      method: "POST",
      body: formData,
    });

    const d1 = Date.now() - t1;

    if (!res.ok) {
      const body = await res.text();
      results.push({
        name: "Upload + Parse",
        passed: false,
        duration: d1,
        error: `${res.status}: ${body}`,
      });
      return results;
    }

    const json = await res.json();
    parsed = json.parsed;
    fileUrl = json.fileUrl;

    results.push({ name: "Upload + Parse", passed: true, duration: d1 });
    console.log(`  ${green("✓")} Upload + Parse ${dim(`(${d1}ms)`)}`);
  } catch (err) {
    results.push({
      name: "Upload + Parse",
      passed: false,
      duration: Date.now() - t1,
      error: String(err),
    });
    console.log(`  ${red("✗")} Upload + Parse: ${err}`);
    return results;
  }

  // Step 2: Validate parsed data
  const t2 = Date.now();
  const requiredFields = ["name", "role", "skills", "experience", "education"];
  const missingFields = requiredFields.filter(
    (f) => parsed?.[f] === undefined || parsed?.[f] === null,
  );

  if (missingFields.length === 0) {
    results.push({ name: "Schema validation", passed: true, duration: Date.now() - t2 });
    console.log(`  ${green("✓")} Schema validation ${dim(`(${Date.now() - t2}ms)`)}`);
    console.log(dim(`    name="${parsed?.name}", role="${parsed?.role}"`));

    const skills = parsed?.skills as { hard?: unknown[]; soft?: unknown[] } | undefined;
    const exp = parsed?.experience as unknown[] | undefined;
    const edu = parsed?.education as unknown[] | undefined;
    console.log(
      dim(
        `    ${skills?.hard?.length ?? 0} hard skills, ${skills?.soft?.length ?? 0} soft skills, ${exp?.length ?? 0} experiences, ${edu?.length ?? 0} education`,
      ),
    );
  } else {
    results.push({
      name: "Schema validation",
      passed: false,
      duration: Date.now() - t2,
      error: `Missing: ${missingFields.join(", ")}`,
    });
    console.log(`  ${red("✗")} Schema validation: missing ${missingFields.join(", ")}`);
  }

  // Step 3: Save to DB
  let candidateId: string | null = null;
  const t3 = Date.now();
  try {
    const saveRes = await fetch(`${BASE_URL}/api/cv-upload/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsed, fileUrl }),
    });

    const d3 = Date.now() - t3;

    if (!saveRes.ok) {
      const body = await saveRes.text();
      results.push({
        name: "Save to DB",
        passed: false,
        duration: d3,
        error: `${saveRes.status}: ${body}`,
      });
      console.log(`  ${red("✗")} Save to DB: ${saveRes.status}`);
    } else {
      const saveJson = await saveRes.json();
      candidateId = saveJson.data?.id ?? saveJson.candidate?.id ?? null;
      results.push({ name: "Save to DB", passed: true, duration: d3 });
      console.log(`  ${green("✓")} Save to DB ${dim(`(${d3}ms) id=${candidateId}`)}`);
    }
  } catch (err) {
    results.push({
      name: "Save to DB",
      passed: false,
      duration: Date.now() - t3,
      error: String(err),
    });
    console.log(`  ${red("✗")} Save to DB: ${err}`);
  }

  // Step 4: Cleanup — delete test candidate
  if (candidateId) {
    const t4 = Date.now();
    try {
      const delRes = await fetch(`${BASE_URL}/api/kandidaten/${candidateId}`, {
        method: "DELETE",
      });
      const d4 = Date.now() - t4;
      const cleanedUp = delRes.ok;
      results.push({ name: "Cleanup (delete)", passed: cleanedUp, duration: d4 });
      console.log(`  ${cleanedUp ? green("✓") : red("✗")} Cleanup ${dim(`(${d4}ms)`)}`);
    } catch (err) {
      results.push({
        name: "Cleanup (delete)",
        passed: false,
        duration: Date.now() - t4,
        error: String(err),
      });
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);

  let files: string[];
  if (args.includes("--all")) {
    // Test all PDF fixtures
    files = fs
      .readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith(".pdf"))
      .map((f) => path.join(FIXTURES_DIR, f));
    if (files.length === 0) {
      console.log(red("No PDF fixtures found. Run: pnpm tsx scripts/generate-test-cv.ts"));
      process.exit(1);
    }
  } else if (args.length > 0 && !args[0].startsWith("-")) {
    files = [path.resolve(args[0])];
  } else {
    files = [DEFAULT_FIXTURE];
  }

  console.log(bold("\nCV Upload Pipeline — Integration Test"));
  console.log(dim(`Base URL: ${BASE_URL}`));
  console.log(dim(`Files: ${files.length}`));

  const allResults: TestResult[] = [];
  for (const file of files) {
    const results = await testFile(file);
    allResults.push(...results);
  }

  // Summary
  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(dim("\n─".repeat(50)));
  console.log(
    `\n${bold("Results:")} ${green(`${passed} passed`)}${failed > 0 ? `, ${red(`${failed} failed`)}` : ""} ${dim(`(${totalDuration}ms)`)}`,
  );

  if (failed > 0) {
    console.log(`\n${red("Failed tests:")}`);
    for (const r of allResults.filter((r) => !r.passed)) {
      console.log(`  ${red("✗")} ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }
}

main();
