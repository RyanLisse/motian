import { ModalClient } from "modal";

/**
 * Self-contained Node.js ES module script that runs inside a Modal sandbox.
 * Uses Stagehand v3 + Playwright to log in to Striive, scrape listings,
 * and enrich with detail pages. Outputs JSON array to stdout.
 */
const SANDBOX_SCRIPT = `
import { z } from "zod";

const STRIIVE_USERNAME = process.env.STRIIVE_USERNAME;
const STRIIVE_PASSWORD = process.env.STRIIVE_PASSWORD;
const targetUrl = process.argv[2];

if (!STRIIVE_USERNAME || !STRIIVE_PASSWORD) {
  process.stderr.write("STRIIVE_USERNAME and STRIIVE_PASSWORD must be set\\n");
  process.exit(1);
}
if (!targetUrl) {
  process.stderr.write("Usage: node scrape.mjs <url>\\n");
  process.exit(1);
}

async function main() {
  const { Stagehand } = await import("@browserbasehq/stagehand");

  const stagehand = new Stagehand({
    env: "LOCAL",
    enableCaching: false,
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  const MAX_RETRIES = 2;
  let attempt = 0;

  try {
    while (attempt <= MAX_RETRIES) {
      try {
        // Stap 1: Inloggen op Striive
        await page.goto("https://login.striive.com");
        await page.waitForLoadState("networkidle");
        await stagehand.act(
          \\\`Vul het e-mailadres "\\\${STRIIVE_USERNAME}" in en klik op volgende\\\`
        );
        await stagehand.act(
          \\\`Vul het wachtwoord "\\\${STRIIVE_PASSWORD}" in en klik op inloggen\\\`
        );

        await page.waitForURL("**/striive.com/**", { timeout: 20000 }).catch(() => {});
        await page.waitForLoadState("networkidle");
        await new Promise(r => setTimeout(r, 2000));
        process.stderr.write("Login compleet, navigeren naar opdrachten...\\n");

        // Stap 2: Navigeer naar opdrachten
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        await page.waitForSelector(
          '[data-testid="job-list"], .opdrachten-lijst, main, .p-card, .assignment-card, app-root',
          { timeout: 20000 }
        );

        // Stap 3: Paginated extraction
        const MAX_PAGES = 5;
        const allListings = [];

        const listingSchema = z.object({
          opdrachten: z.array(
            z.object({
              title: z.string().describe("de functietitel/rol"),
              company: z.string().optional().describe("de opdrachtgever (eindklant)"),
              contractLabel: z.string().optional().describe("het contractlabel/broker"),
              location: z.string().optional().describe("stad en provincie"),
              description: z.string().describe("de korte omschrijving op de kaart"),
              rateMax: z.number().optional().describe("maximale uurtarief"),
              positionsAvailable: z.number().optional().describe("aantal posities"),
              startDate: z.string().optional().describe("startdatum YYYY-MM-DD"),
              endDate: z.string().optional().describe("einddatum YYYY-MM-DD"),
              applicationDeadline: z.string().optional().describe("reageren kan t/m datum YYYY-MM-DD"),
              externalId: z.string().describe("referentiecode bijv. BTBDN000695"),
              clientReferenceCode: z.string().optional().describe("referentiecode opdrachtgever"),
              externalUrl: z.string().describe("volledige URL naar de opdracht detailpagina"),
            })
          ),
        });

        for (let p = 1; p <= MAX_PAGES; p++) {
          const result = await stagehand.extract(
            "Extraheer alle zichtbare opdrachten van deze Striive overzichtspagina. " +
            "Per opdracht extraheer de kaart-informatie: titel, opdrachtgever, contractlabel, " +
            "locatie, omschrijving, uurtarief, posities, start/einddatum, deadline, referentiecode, en URL.",
            listingSchema
          );

          allListings.push(...(result.opdrachten ?? []));

          const hasNext = await page
            .locator('a:has-text("Volgende"), button:has-text("Volgende"), [aria-label="Volgende"]')
            .isVisible()
            .catch(() => false);
          if (!hasNext) break;
          await stagehand.act("Klik op de volgende pagina knop");
          await page.waitForSelector(
            '[data-testid="job-list"], .opdrachten-lijst, main',
            { timeout: 10000 }
          );
        }

        process.stderr.write("Striive: " + allListings.length + " opdrachten gevonden\\n");

        // Stap 4: Detail-pagina enrichment
        const detailSchema = z.object({
          description: z.string().optional().describe("VOLLEDIGE opdrachtomschrijving"),
          rateMax: z.number().optional().describe("maximale uurtarief exclusief BTW"),
          workArrangement: z.string().optional().describe("hybride, op_locatie, of remote"),
          allowsSubcontracting: z.boolean().optional().describe("doorleenconstructie toegestaan"),
          requirements: z
            .array(
              z.object({
                description: z.string().describe("de volledige eis tekst"),
                isKnockout: z.boolean().default(true),
              })
            )
            .optional()
            .describe("Harde eisen uit de Eisen sectie"),
          wishes: z
            .array(
              z.object({
                description: z.string().describe("de wens tekst"),
                evaluationCriteria: z.string().optional().describe("weging of criteria"),
              })
            )
            .optional()
            .describe("Wensen uit de Gunningscriteria sectie"),
          competences: z.array(z.string()).optional().describe("Competenties/soft skills tags"),
          conditions: z.array(z.string()).optional().describe("Voorwaarden zoals WKA, G-rekening"),
        });

        const enriched = [];
        for (const listing of allListings) {
          const province =
            listing.province ??
            (listing.location?.includes(" - ")
              ? listing.location.split(" - ")[1]?.trim()
              : undefined);

          if (!listing.externalUrl) {
            enriched.push({ ...listing, province });
            continue;
          }

          try {
            await page.goto(listing.externalUrl, {
              waitUntil: "networkidle",
              timeout: 20000,
            });

            await page.evaluate(() =>
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
            );
            await new Promise(r => setTimeout(r, 1500));
            await page.evaluate(() => window.scrollTo({ top: 0 }));
            await new Promise(r => setTimeout(r, 500));

            const detail = await stagehand.extract(
              "Extraheer de volledige details van deze Striive opdracht detailpagina. " +
              "De pagina heeft opeenvolgende secties (GEEN tabs). Scroll door de hele pagina. " +
              "Extraheer: volledige omschrijving, uurtarief, thuiswerken beleid, doorleen, " +
              "alle eisen (Eisen/Harde eisen sectie), alle wensen (Wensen/Gunningscriteria sectie), " +
              "competenties (tags/chips), en voorwaarden (WKA, G-rekening, SNA etc).",
              detailSchema
            );

            enriched.push({
              ...listing,
              description: detail.description || listing.description,
              rateMax: detail.rateMax ?? listing.rateMax,
              workArrangement: detail.workArrangement ?? listing.workArrangement,
              allowsSubcontracting: detail.allowsSubcontracting ?? listing.allowsSubcontracting,
              requirements: detail.requirements?.length ? detail.requirements : listing.requirements,
              wishes: detail.wishes?.length ? detail.wishes : listing.wishes,
              competences: detail.competences?.length ? detail.competences : listing.competences,
              conditions: detail.conditions?.length ? detail.conditions : listing.conditions,
              province,
            });

            process.stderr.write(
              "Detail verrijkt: " + listing.externalId +
              " (" + (detail.requirements?.length ?? 0) + " eisen, " +
              (detail.wishes?.length ?? 0) + " wensen)\\n"
            );
          } catch (detailErr) {
            process.stderr.write("Detail-pagina mislukt voor " + listing.externalId + ": " + detailErr + "\\n");
            enriched.push({ ...listing, province });
          }
        }

        // Output JSON to stdout for the wrapper to parse
        console.log(JSON.stringify(enriched));
        await stagehand.close();
        process.exit(0);
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          process.stderr.write("Striive scrape definitief mislukt na " + (MAX_RETRIES + 1) + " pogingen: " + err + "\\n");
          console.log(JSON.stringify([]));
          await stagehand.close();
          process.exit(1);
        }
        const base = 1200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = base + jitter;
        process.stderr.write("Striive scrape poging " + attempt + " mislukt, retry in " + delay + "ms: " + err + "\\n");
        await new Promise(r => setTimeout(r, delay));
      }
    }
  } catch (fatal) {
    process.stderr.write("Fatal error: " + fatal + "\\n");
    console.log(JSON.stringify([]));
    try { await stagehand.close(); } catch {}
    process.exit(1);
  }
}

main();
`;

/**
 * Scrape Striive opdrachten via a Modal sandbox running Playwright + Stagehand.
 * The sandbox boots Node 22 with Playwright pre-installed, writes a self-contained
 * scraper script, executes it, and parses JSON output from stdout.
 *
 * Returns an empty array on any failure.
 */
export async function scrapeStriive(url: string): Promise<any[]> {
  const username = process.env.STRIIVE_USERNAME;
  const password = process.env.STRIIVE_PASSWORD;

  if (!username || !password) {
    console.error("[striive] STRIIVE_USERNAME and STRIIVE_PASSWORD must be set");
    return [];
  }

  let modal: ModalClient | undefined;

  try {
    modal = new ModalClient();

    // 1. Get or create app
    const app = await modal.apps.fromName("motian-scraper", {
      createIfMissing: true,
    });

    // 2. Build image: Node 22 slim + Playwright + Stagehand + Zod
    const image = modal.images
      .fromRegistry("node:22-slim")
      .dockerfileCommands([
        "RUN apt-get update && apt-get install -y wget gnupg ca-certificates && rm -rf /var/lib/apt/lists/*",
        "RUN npx playwright install --with-deps chromium",
        "RUN npm install -g @browserbasehq/stagehand@latest zod playwright",
      ]);

    // 3. Create sandbox with credentials and generous timeout
    const sandbox = await modal.sandboxes.create(app, image, {
      env: {
        STRIIVE_USERNAME: username,
        STRIIVE_PASSWORD: password,
        STAGEHAND_ENV: "LOCAL",
      },
      timeoutMs: 10 * 60 * 1000, // 10 minutes
      workdir: "/root",
    });

    try {
      // 4. Write the scraper script into the sandbox filesystem
      const scriptFile = await sandbox.open("/root/scrape.mjs", "w");
      await scriptFile.write(new TextEncoder().encode(SANDBOX_SCRIPT));
      await scriptFile.flush();
      await scriptFile.close();

      // 5. Execute the script inside the sandbox
      const proc = await sandbox.exec(["node", "/root/scrape.mjs", url], {
        timeoutMs: 8 * 60 * 1000, // 8 minutes
      });

      const exitCode = await proc.wait();
      const stdout = await proc.stdout.readText();
      const stderr = await proc.stderr.readText();

      if (stderr) {
        for (const line of stderr.split("\n").filter(Boolean)) {
          console.log(`[striive/sandbox] ${line}`);
        }
      }

      if (exitCode !== 0) {
        console.error(`[striive] Sandbox process exited with code ${exitCode}`);
        return [];
      }

      // 6. Parse JSON from stdout (last line is the JSON output)
      const lines = stdout.trim().split("\n");
      const jsonLine = lines[lines.length - 1];
      if (!jsonLine) return [];

      const listings = JSON.parse(jsonLine);
      if (!Array.isArray(listings)) {
        console.error("[striive] Unexpected output format from sandbox");
        return [];
      }

      console.log(`[striive] Scrape compleet: ${listings.length} opdrachten`);
      return listings;
    } finally {
      // 7. Always terminate sandbox to avoid lingering costs
      await sandbox.terminate().catch(() => {});
    }
  } catch (err) {
    console.error(`[striive] Modal sandbox scrape mislukt: ${err}`);

    // Fallback: try CLI-based sandbox if SDK fails
    return scrapeStriiveCli(url).catch((cliErr) => {
      console.error(`[striive] CLI fallback ook mislukt: ${cliErr}`);
      return [];
    });
  }
}

/**
 * Fallback: use `modal sandbox` CLI commands via child_process if the
 * JS SDK sandbox API is unavailable or errors out at runtime.
 */
async function scrapeStriiveCli(url: string): Promise<any[]> {
  const { execFile } = await import("node:child_process");
  const { writeFile, unlink } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { promisify } = await import("node:util");

  const execFileAsync = promisify(execFile);
  const scriptPath = join(tmpdir(), `striive-scrape-${Date.now()}.mjs`);

  try {
    await writeFile(scriptPath, SANDBOX_SCRIPT, "utf-8");

    // Create sandbox via Modal CLI
    const { stdout: createOut } = await execFileAsync("modal", [
      "sandbox",
      "create",
      "node:22-slim",
      "--timeout",
      "600",
    ], { timeout: 60_000 });

    const sbId = createOut.trim().split("\n").pop()?.trim() ?? "";
    if (!sbId) {
      throw new Error("Failed to create modal sandbox via CLI");
    }

    try {
      // Install dependencies in sandbox
      await execFileAsync("modal", [
        "sandbox",
        "exec",
        sbId,
        "bash",
        "-c",
        "apt-get update && apt-get install -y wget gnupg ca-certificates && " +
        "npx playwright install --with-deps chromium && " +
        "npm install @browserbasehq/stagehand@latest zod",
      ], { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 });

      // Write script to sandbox via exec + heredoc
      const escapedScript = SANDBOX_SCRIPT.replace(/'/g, "'\\''");
      await execFileAsync("modal", [
        "sandbox",
        "exec",
        sbId,
        "bash",
        "-c",
        `cat > /root/scrape.mjs << 'ENDOFSCRIPT'\n${escapedScript}\nENDOFSCRIPT`,
      ], { timeout: 30_000, maxBuffer: 1024 * 1024 });

      // Run the scraper
      const { stdout, stderr } = await execFileAsync("modal", [
        "sandbox",
        "exec",
        sbId,
        "--",
        "env",
        `STRIIVE_USERNAME=${process.env.STRIIVE_USERNAME}`,
        `STRIIVE_PASSWORD=${process.env.STRIIVE_PASSWORD}`,
        "STAGEHAND_ENV=LOCAL",
        "node",
        "/root/scrape.mjs",
        url,
      ], { timeout: 8 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

      if (stderr) {
        for (const line of stderr.split("\n").filter(Boolean)) {
          console.log(`[striive/cli] ${line}`);
        }
      }

      const lines = stdout.trim().split("\n");
      const jsonLine = lines[lines.length - 1];
      if (!jsonLine) return [];

      return JSON.parse(jsonLine);
    } finally {
      await execFileAsync("modal", ["sandbox", "terminate", sbId], {
        timeout: 10_000,
      }).catch(() => {});
    }
  } finally {
    await unlink(scriptPath).catch(() => {});
  }
}
