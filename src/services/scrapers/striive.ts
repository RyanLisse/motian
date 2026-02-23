/**
 * Striive scraper — uses Playwright for login, then the Striive supplier API.
 *
 * Local mode:   runs Playwright directly (for dev/testing)
 * Webhook mode: calls a remote endpoint that runs Playwright (for production/Vercel)
 *
 * Set STRIIVE_USE_MODAL=true + STRIIVE_WEBHOOK_URL to use remote webhook.
 */

const MAPPING_FUNCTIONS_AS_STRING = `
function mapBoolean(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val === "YES" || val === "true") return true;
    if (val === "NO" || val === "false") return false;
  }
  return undefined;
}

function mapWorkArrangement(remote) {
  if (!remote) return undefined;
  switch (remote) {
    case "HYBRID": return "hybride";
    case "NO": return "op_locatie";
    case "YES": return "remote";
    default: return undefined;
  }
}

function mapBasicListing(job) {
  const loc = job.locationName ?? "";
  const province = loc.includes(" - ") ? loc.split(" - ")[1]?.trim() : undefined;

  return {
    title: job.title ?? "",
    company: job.client?.name ?? "",
    location: loc || undefined,
    province,
    description: job.description ?? job.shortDescription ?? "",
    externalId: job.referenceCode ?? String(job.id ?? ""),
    externalUrl: \`https://supplier.striive.com/jobrequests/\${job.id ?? ""}\`,
    rateMax: undefined,
    startDate: job.startDate ?? undefined,
    endDate: job.endDate ?? undefined,
    applicationDeadline: job.closingDateOffer ?? undefined,
    postedAt: job.publishedAt ?? undefined,
    contractLabel: job.source ?? undefined,
    positionsAvailable: 1,
  };
}

function mapDetailListing(job, detail) {
  const base = mapBasicListing(job);

  const requirements = [];
  if (detail.requirements?.length) {
    for (const r of detail.requirements) {
      const desc = typeof r === "string" ? r : (r.requirement ?? r.description ?? "");
      if (desc) {
        requirements.push({
          description: desc,
          isKnockout: r.type === "KNOCKOUT",
        });
      }
    }
  }

  const wishes = [];
  if (detail.wishes?.length) {
    for (const w of detail.wishes) {
      const desc = typeof w === "string" ? w : (w.wish ?? w.description ?? "");
      if (desc) {
        wishes.push({ description: desc });
      }
    }
  }

  const competences = [];

  const conditions = [];
  if (typeof detail.conditions === "string" && detail.conditions.length > 0) {
    conditions.push(detail.conditions);
  }

  const detailLocation = detail.location
    ? \`\${detail.location.city ?? ""}\${detail.location.zone ? \` - \${detail.location.zone}\` : ""}\`
    : base.location;
  const detailProvince = detail.location?.zone ?? base.province;

  return {
    ...base,
    location: detailLocation || base.location,
    province: detailProvince || base.province,
    description:
      detail.description && detail.description.length > (base.description?.length ?? 0)
        ? detail.description
        : base.description,
    rateMax:
      detail.maxHourlyRate && detail.maxHourlyRate > 0
        ? Math.round(detail.maxHourlyRate)
        : detail.minHourlyRate && detail.minHourlyRate > 0
          ? Math.round(detail.minHourlyRate)
          : base.rateMax,
    rateMin:
      detail.minHourlyRate && detail.minHourlyRate > 0
        ? Math.round(detail.minHourlyRate)
        : undefined,
    workArrangement: mapWorkArrangement(detail.remoteAllowed),
    allowsSubcontracting: mapBoolean(detail.onLendingAllowed),
    clientReferenceCode: detail.referenceCodeClient || undefined,
    contractType: mapContractType(detail.typeOfProfessional),
    postedAt: detail.publishedAt ?? base.postedAt,
    requirements: requirements.length > 0 ? requirements : [],
    wishes: wishes.length > 0 ? wishes : [],
    competences,
    conditions,
    positionsAvailable: detail.positionsCount ?? base.positionsAvailable,

    hoursPerWeek: detail.hoursPerWeek ?? undefined,
    minHoursPerWeek: detail.minHoursPerWeek ?? undefined,
    extensionPossible: detail.extensionPossible ?? undefined,
    countryCode: detail.countryCode ?? undefined,
    remunerationType: detail.remunerationType ?? undefined,
    workExperienceYears: detail.workExperienceYears ?? undefined,
    numberOfViews: detail.numberOfViews ?? undefined,
    attachments: (detail.attachments ?? []).map((a) => ({
      url: a.file?.url ?? "",
      description: a.description ?? "",
    })),
    questions: (detail.questions ?? []).map((q) => ({
      question: q.question,
      type: q.type,
      options: q.options ?? [],
    })),
    languages: (detail.languages ?? []).map((l) => l.language?.languageCode).filter(Boolean),
    descriptionSummary: detail.descriptionSummary ?? undefined,
    faqAnswers: (detail.faqAnswerCategories ?? []).flatMap((cat) =>
      (cat.faqAnswers ?? []).map((faq) => ({
        category: cat.label,
        question: faq.question,
        answer: faq.answer,
      })),
    ),
    agentContact: detail.agent
      ? {
          name: detail.agent.name ?? "",
          email: detail.agent.email ?? "",
          phone: detail.agent.phone ?? "",
        }
      : undefined,
    recruiterContact: detail.recruiter
      ? {
          name: detail.recruiter.name ?? "",
          email: detail.recruiter.email ?? "",
          phone: detail.recruiter.phone ?? "",
        }
      : undefined,
  };
}

function mapContractType(type) {
  if (!type) return undefined;
  switch (type) {
    case "FREELANCER": return "freelance";
    case "EMPLOYEES_ONLY": return "vast";
    case "INTERIM": return "interim";
    case "CONTRACTOR": return "opdracht";
    default: return undefined;
  }
}
`;

const STRIIVE_API_LIST = "https://supplier.striive.com/api/v2/job-requests";
const STRIIVE_API_DETAIL = "https://supplier.striive.com/api/job-requests";

const MODAL_SCRAPE_SCRIPT = `
const API_LIST = "${STRIIVE_API_LIST}";
const API_DETAIL = "${STRIIVE_API_DETAIL}";

${MAPPING_FUNCTIONS_AS_STRING}

async function run() {
  const { chromium } = require("playwright-core");
  const username = process.env.STRIIVE_USERNAME;
  const password = process.env.STRIIVE_PASSWORD;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[striive-modal] Navigating to login...");
    await page.goto("https://login.striive.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.locator("#email").fill(username);
    await new Promise(r => setTimeout(r, 300));
    await page.locator("#password").fill(password);
    await new Promise(r => setTimeout(r, 300));
    const loginBtn = page.locator('[data-testid="login"]');
    await loginBtn.click({ timeout: 10000 });
    await page.waitForURL("**/supplier.striive.com/**", { timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    console.log("[striive-modal] Login complete. URL:", page.url());

    const cookies = await context.cookies();
    let cookie = cookies.map(c => c.name + "=" + c.value).join("; ");

    console.log("[striive-modal] Verifying API access...");
    let testRes = await fetch(API_LIST + "?page=0&size=1", {
      headers: { Cookie: cookie, Accept: "application/json" },
    });
    if (!testRes.ok) {
      console.log("[striive-modal] API test failed, navigating to supplier portal...");
      await page.goto("https://supplier.striive.com/jobrequests/list", {
        waitUntil: "domcontentloaded", timeout: 20000,
      });
      await new Promise(r => setTimeout(r, 2000));
      const cookies2 = await context.cookies();
      cookie = cookies2.map(c => c.name + "=" + c.value).join("; ");
      const testRes2 = await fetch(API_LIST + "?page=0&size=1", {
        headers: { Cookie: cookie, Accept: "application/json" },
      });
      if (!testRes2.ok) {
        throw new Error(\`API still fails after navigation: \${testRes2.status}\`);
      }
      console.log("[striive-modal] API access verified after navigation");
    } else {
      console.log("[striive-modal] API access verified");
    }
    await browser.close();

    console.log("[striive-modal] Fetching listings from API...");
    const allJobs = [];
    let pageNum = 0;
    const PAGE_SIZE = 50;

    while (true) {
      const res = await fetch(API_LIST + "?page=" + pageNum + "&size=" + PAGE_SIZE + "&status=OPEN", {
        headers: { Cookie: cookie, Accept: "application/json" },
      });

      if (!res.ok) {
        console.error(\`[striive-modal] API page \${pageNum} failed: \${res.status}\`);
        break;
      }

      const data = await res.json();
      const jobs = Array.isArray(data) ? data : (data.content || data.items || []);

      if (!Array.isArray(jobs) || jobs.length === 0) break;

      allJobs.push(...jobs);
      console.log(\`[striive-modal] Page \${pageNum}: \${jobs.length} jobs (total: \${allJobs.length})\`);

      if (jobs.length < PAGE_SIZE) break;
      pageNum++;
      if (pageNum > 20) break;
    }
    console.log(\`[striive-modal] Total listings: \${allJobs.length}\`);

    console.log("[striive-modal] Enriching listings with detail pages...");
    const enriched = [];
    const DETAIL_DELAY = 300;

    for (const job of allJobs) {
      const jobId = job.id || job.externalId || "";
      if (!jobId) {
        enriched.push(mapBasicListing(job));
        continue;
      }

      try {
        const dRes = await fetch(API_DETAIL + "/" + encodeURIComponent(jobId), {
          headers: { Cookie: cookie, Accept: "application/json" },
        });

        if (!dRes.ok) {
          if (dRes.status === 401 || dRes.status === 403) {
            console.error("[striive-modal] Session expired during enrichment");
            break;
          }
          enriched.push(mapBasicListing(job));
          continue;
        }

        const detail = await dRes.json();
        enriched.push(mapDetailListing(job, detail));
      } catch (err) {
        console.error(\`[striive-modal] Detail failed for \${jobId}: \${err}\`);
        enriched.push(mapBasicListing(job));
      }
      await new Promise(r => setTimeout(r, DETAIL_DELAY));
    }
    console.log(\`[striive-modal] Enriched \${enriched.length} listings\`);
    console.log("__MODAL_RESULT__" + JSON.stringify(enriched));
  } catch (err) {
    await browser.close().catch(() => {});
    console.error("Scrape failed:", err);
    process.exit(1);
  }
}
run();
`;

/**
 * Main entry point — scrapes Striive listings via Modal sandbox.
 */
export async function scrapeStriive(_url: string): Promise<Record<string, unknown>[]> {
  const username = process.env.STRIIVE_USERNAME;
  const password = process.env.STRIIVE_PASSWORD;

  if (!username || !password) {
    console.error("[striive] STRIIVE_USERNAME and STRIIVE_PASSWORD must be set");
    return [];
  }

  return scrapeViaModal(username, password);
}

async function scrapeViaModal(
  username: string,
  password: string,
): Promise<Record<string, unknown>[]> {
  const { ModalClient } = await import("modal");
  console.log("[striive] Starting Modal sandbox scrape...");

  try {
    const modal = new ModalClient();
    const app = await modal.apps.fromName("motian-scraper", { createIfMissing: true });

    const image = modal.images
      .fromRegistry("node:22-slim")
      .dockerfileCommands([
        "RUN apt-get update && apt-get install -y wget gnupg ca-certificates",
        "RUN cd /root && npm init -y && npm install playwright-core",
        "RUN npx --yes playwright install --with-deps chromium",
      ]);

    const sandbox = await modal.sandboxes.create(app, image, {
      env: {
        STRIIVE_USERNAME: username,
        STRIIVE_PASSWORD: password,
      },
      timeoutMs: 10 * 60 * 1000,
      workdir: "/root",
    });

    console.log("[striive] Modal sandbox created, executing scrape script...");

    // Write the scraping script into the sandbox
    await sandbox.exec(
      ["bash", "-c", `cat > /root/scrape.js << 'SCRIPT_EOF'\n${MODAL_SCRAPE_SCRIPT}\nSCRIPT_EOF`],
      { timeoutMs: 10_000 },
    );

    // Execute the script
    const proc = await sandbox.exec(["node", "/root/scrape.js"], {
      timeoutMs: 8 * 60 * 1000,
    });

    const exitCode = await proc.wait();
    const stdout = await proc.stdout.readText();
    const stderr = await proc.stderr.readText();

    await sandbox.terminate().catch(() => {});

    if (exitCode !== 0) {
      const stderrSnippet = stderr ? stderr.substring(0, 500) : "(no stderr)";
      console.error(`[striive] Modal sandbox exited with code ${exitCode}`);
      if (stdout) console.error(`[striive] stdout: ${stdout.substring(0, 500)}`);
      if (stderr) console.error(`[striive] stderr: ${stderrSnippet}`);
      throw new Error(`Modal sandbox exited with code ${exitCode}: ${stderrSnippet}`);
    }

    // Extract JSON results from the sentinel marker in stdout
    const marker = "__MODAL_RESULT__";
    const markerIdx = stdout.indexOf(marker);
    if (markerIdx === -1) {
      console.error("[striive] No result marker found in Modal sandbox output");
      console.error(`[striive] Full stdout: ${stdout}`); // Log full stdout for debugging
      return [];
    }

    const results = JSON.parse(stdout.substring(markerIdx + marker.length));
    console.log(`[striive] Modal sandbox returned ${results.length} listings`);
    return results;
  } catch (err) {
    console.error(`[striive] Modal scrape failed: ${err}`);
    return [];
  }
}
