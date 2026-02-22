/**
 * Striive scraper — uses Playwright for login, then the Striive supplier API.
 *
 * Local mode:  runs Playwright directly (for dev/testing)
 * Modal mode:  runs inside a Modal sandbox (for production/Vercel)
 *
 * Set STRIIVE_USE_MODAL=true to use Modal sandbox.
 */

const API_LIST = "https://supplier.striive.com/api/v2/job-requests";
const API_DETAIL = "https://supplier.striive.com/api/job-requests";
const DETAIL_DELAY = 300;

/**
 * Main entry point — scrapes Striive listings with full detail enrichment.
 */
export async function scrapeStriive(_url: string): Promise<any[]> {
  const username = process.env.STRIIVE_USERNAME;
  const password = process.env.STRIIVE_PASSWORD;

  if (!username || !password) {
    console.error("[striive] STRIIVE_USERNAME and STRIIVE_PASSWORD must be set");
    return [];
  }

  if (process.env.STRIIVE_USE_MODAL === "true") {
    return scrapeViaModal(username, password);
  }

  return scrapeLocal(username, password);
}

/**
 * Local scraper — runs Playwright on the current machine.
 */
async function scrapeLocal(username: string, password: string): Promise<any[]> {
  const { chromium } = await import("playwright");

  console.log("[striive] Starting local Playwright scrape...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // === Login (single-step form: email + password visible simultaneously) ===
    console.log("[striive] Navigating to login...");
    await page.goto("https://login.striive.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // Wait for Angular to hydrate

    // Fill both fields — button only enables when both are filled
    await page.locator("#email").fill(username);
    await new Promise(r => setTimeout(r, 300));
    await page.locator("#password").fill(password);
    await new Promise(r => setTimeout(r, 300));

    // Click login
    const loginBtn = page.locator('[data-testid="login"]');
    await loginBtn.click({ timeout: 10000 });

    // Wait for redirect to supplier dashboard
    await page.waitForURL("**/supplier.striive.com/**", { timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    console.log("[striive] Login complete. URL:", page.url());

    // === Extract cookies ===
    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    console.log(`[striive] Got ${cookies.length} cookies`);

    // Verify API access
    let activeCookie = cookieHeader;
    const testRes = await fetch(`${API_LIST}?page=0&size=1`, {
      headers: { Cookie: activeCookie, Accept: "application/json" },
    });

    if (!testRes.ok) {
      console.log(`[striive] API test failed (${testRes.status}), navigating to supplier portal...`);
      await page.goto("https://supplier.striive.com/jobrequests/list", { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      const cookies2 = await context.cookies();
      activeCookie = cookies2.map(c => `${c.name}=${c.value}`).join("; ");

      const testRes2 = await fetch(`${API_LIST}?page=0&size=1`, {
        headers: { Cookie: activeCookie, Accept: "application/json" },
      });
      if (!testRes2.ok) {
        throw new Error(`API still fails after navigation: ${testRes2.status}`);
      }
      console.log("[striive] API access verified after navigation");
    } else {
      console.log("[striive] API access verified");
    }

    await browser.close();

    // === Fetch listings via API ===
    return fetchAndEnrichListings(activeCookie);
  } catch (err) {
    console.error(`[striive] Scrape failed: ${err}`);
    await browser.close().catch(() => {});
    return [];
  }
}

/**
 * Fetch all listings from Striive API and enrich with detail pages.
 */
async function fetchAndEnrichListings(cookie: string): Promise<any[]> {
  console.log("[striive] Fetching listings from API...");

  const allJobs: any[] = [];
  let pageNum = 0;
  const PAGE_SIZE = 50;

  while (true) {
    const res = await fetch(`${API_LIST}?page=${pageNum}&size=${PAGE_SIZE}&status=OPEN`, {
      headers: { Cookie: cookie, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[striive] API page ${pageNum} failed: ${res.status}`);
      break;
    }

    const data = await res.json();
    // API returns a plain array directly
    const jobs = Array.isArray(data) ? data : data.content ?? data.items ?? [];

    if (!Array.isArray(jobs) || jobs.length === 0) break;

    allJobs.push(...jobs);
    console.log(`[striive] Page ${pageNum}: ${jobs.length} jobs (total: ${allJobs.length})`);

    if (jobs.length < PAGE_SIZE) break;
    pageNum++;
    if (pageNum > 20) break; // Safety limit
  }

  console.log(`[striive] Total listings: ${allJobs.length}`);

  // === Enrich with detail pages ===
  const enriched: any[] = [];
  let enrichCount = 0;

  for (const job of allJobs) {
    const jobId = job.id ?? job.externalId ?? "";
    if (!jobId) {
      enriched.push(mapBasicListing(job));
      continue;
    }

    try {
      const detailRes = await fetch(`${API_DETAIL}/${encodeURIComponent(jobId)}`, {
        headers: { Cookie: cookie, Accept: "application/json" },
      });

      if (!detailRes.ok) {
        if (detailRes.status === 401 || detailRes.status === 403) {
          console.error("[striive] Session expired during enrichment");
          break;
        }
        enriched.push(mapBasicListing(job));
        continue;
      }

      const detail = await detailRes.json();
      enriched.push(mapDetailListing(job, detail));
      enrichCount++;
    } catch (err) {
      console.error(`[striive] Detail failed for ${jobId}: ${err}`);
      enriched.push(mapBasicListing(job));
    }

    await new Promise(r => setTimeout(r, DETAIL_DELAY));
  }

  console.log(`[striive] Enriched ${enrichCount}/${allJobs.length} listings`);
  return enriched;
}

// === Mapping functions ===

function mapBoolean(val: any): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val === "YES" || val === "true") return true;
    if (val === "NO" || val === "false") return false;
  }
  return undefined;
}

function mapWorkArrangement(remote?: string): "remote" | "hybride" | "op_locatie" | undefined {
  if (!remote) return undefined;
  switch (remote) {
    case "HYBRID": return "hybride";
    case "NO": return "op_locatie";
    case "YES": return "remote";
    default: return undefined;
  }
}

function mapBasicListing(job: any) {
  const loc = job.locationName ?? "";
  const province = loc.includes(" - ") ? loc.split(" - ")[1]?.trim() : undefined;

  return {
    title: job.title ?? "",
    company: job.client?.name ?? "",
    location: loc || undefined,
    province,
    description: job.description ?? job.shortDescription ?? "",
    externalId: job.referenceCode ?? String(job.id ?? ""),
    externalUrl: `https://supplier.striive.com/jobrequests/${job.id ?? ""}`,
    rateMax: undefined,
    startDate: job.startDate ?? undefined,
    endDate: job.endDate ?? undefined,
    applicationDeadline: job.closingDateOffer ?? undefined,
    postedAt: job.publishedAt ?? undefined,
    contractLabel: job.source ?? undefined, // HEAD_FIRST, BETWEEN etc. = broker/platform
    positionsAvailable: 1,
  };
}

function mapDetailListing(job: any, detail: any) {
  const base = mapBasicListing(job);

  // Requirements: { id, requirement, type, monthsExperience }
  const requirements: Array<{ description: string; isKnockout: boolean }> = [];
  if (detail.requirements?.length) {
    for (const r of detail.requirements) {
      const desc = typeof r === "string" ? r : r.requirement ?? r.description ?? "";
      if (desc) {
        requirements.push({
          description: desc,
          isKnockout: r.type === "KNOCKOUT",
        });
      }
    }
  }

  // Wishes: { id, wish, type, monthsExperience }
  const wishes: Array<{ description: string; evaluationCriteria?: string }> = [];
  if (detail.wishes?.length) {
    for (const w of detail.wishes) {
      const desc = typeof w === "string" ? w : w.wish ?? w.description ?? "";
      if (desc) {
        wishes.push({ description: desc });
      }
    }
  }

  // No separate competences array in detail — competences come from requirements with type=COMPETENCE
  const competences: string[] = [];

  // Conditions is HTML string, not array — parse to array of lines
  const conditions: string[] = [];
  if (typeof detail.conditions === "string" && detail.conditions.length > 0) {
    conditions.push(detail.conditions);
  }

  // Location from detail has structured city + zone (province)
  const detailLocation = detail.location
    ? `${detail.location.city ?? ""}${detail.location.zone ? ` - ${detail.location.zone}` : ""}`
    : base.location;
  const detailProvince = detail.location?.zone ?? base.province;

  return {
    ...base,
    location: detailLocation || base.location,
    province: detailProvince || base.province,
    description: detail.description && detail.description.length > (base.description?.length ?? 0)
      ? detail.description
      : base.description,
    rateMax: (detail.maxHourlyRate && detail.maxHourlyRate > 0)
      ? Math.round(detail.maxHourlyRate)
      : (detail.minHourlyRate && detail.minHourlyRate > 0)
        ? Math.round(detail.minHourlyRate)
        : base.rateMax,
    rateMin: (detail.minHourlyRate && detail.minHourlyRate > 0)
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

    // === Verrijkte Data (dedicated columns) ===
    hoursPerWeek: detail.hoursPerWeek ?? undefined,
    minHoursPerWeek: detail.minHoursPerWeek ?? undefined,
    extensionPossible: detail.extensionPossible ?? undefined,
    countryCode: detail.countryCode ?? undefined,
    remunerationType: detail.remunerationType ?? undefined,
    workExperienceYears: detail.workExperienceYears ?? undefined,
    numberOfViews: detail.numberOfViews ?? undefined,
    attachments: (detail.attachments ?? []).map((a: any) => ({
      url: a.file?.url ?? "",
      description: a.description ?? "",
    })),
    questions: (detail.questions ?? []).map((q: any) => ({
      question: q.question,
      type: q.type,
      options: q.options ?? [],
    })),
    languages: (detail.languages ?? []).map((l: any) => l.language?.languageCode).filter(Boolean),
    descriptionSummary: detail.descriptionSummary ?? undefined,
    faqAnswers: (detail.faqAnswerCategories ?? []).flatMap((cat: any) =>
      (cat.faqAnswers ?? []).map((faq: any) => ({
        category: cat.label,
        question: faq.question,
        answer: faq.answer,
      })),
    ),
    agentContact: detail.agent ? {
      name: detail.agent.name ?? "",
      email: detail.agent.email ?? "",
      phone: detail.agent.phone ?? "",
    } : undefined,
    recruiterContact: detail.recruiter ? {
      name: detail.recruiter.name ?? "",
      email: detail.recruiter.email ?? "",
      phone: detail.recruiter.phone ?? "",
    } : undefined,
  };
}

function mapContractType(type?: string): "freelance" | "interim" | "vast" | "opdracht" | undefined {
  if (!type) return undefined;
  switch (type) {
    case "FREELANCER": return "freelance";
    case "EMPLOYEES_ONLY": return "vast";
    case "INTERIM": return "interim";
    case "CONTRACTOR": return "opdracht";
    default: return undefined;
  }
}

// === Modal sandbox version (for production/Vercel) ===

async function scrapeViaModal(username: string, password: string): Promise<any[]> {
  const { ModalClient } = await import("modal");
  console.log("[striive] Starting Modal sandbox scrape...");

  // This will be implemented once local scraping is proven
  // For now, fall back to local
  console.warn("[striive] Modal mode not yet implemented, falling back to local");
  return scrapeLocal(username, password);
}
