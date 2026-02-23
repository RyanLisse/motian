import { asc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { scrapeResults, scraperConfigs } from "../db/schema";
import { decrypt, encrypt } from "../lib/crypto";

// ========== Types ==========

export type ScraperConfig = typeof scraperConfigs.$inferSelect;

export type PlatformHealth = {
  platform: string;
  isActive: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  runs24h: number;
  failures24h: number;
  failureRate: number;
  status: "gezond" | "waarschuwing" | "kritiek" | "inactief";
};

export type HealthReport = {
  data: PlatformHealth[];
  overall: "gezond" | "waarschuwing" | "kritiek";
};

export type UpdateConfigData = {
  isActive?: boolean;
  cronExpression?: string;
  parameters?: Record<string, unknown>;
};

// ========== Service Functions ==========

/** Alle scraper configuraties ophalen, gesorteerd op platform */
export async function getAllConfigs(): Promise<ScraperConfig[]> {
  return db.select().from(scraperConfigs).orderBy(asc(scraperConfigs.platform));
}

/** Eén scraper configuratie bijwerken op ID. Geeft de bijgewerkte rij terug, of null als niet gevonden. */
export async function updateConfig(
  id: string,
  data: UpdateConfigData,
): Promise<ScraperConfig | null> {
  const result = await db
    .update(scraperConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, id))
    .returning();

  return result[0] ?? null;
}

/** Platform gezondheidsrapport: status per scraper + 24-uurs failure rate */
export async function getHealth(): Promise<HealthReport> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const configs = await db.select().from(scraperConfigs);
  const statsRows = await db
    .select({
      platform: scrapeResults.platform,
      total: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
    })
    .from(scrapeResults)
    .where(gte(scrapeResults.runAt, twentyFourHoursAgo))
    .groupBy(scrapeResults.platform);

  const statsMap = new Map(statsRows.map((s) => [s.platform, s]));

  const health: PlatformHealth[] = configs.map((cfg) => {
    const failures = cfg.consecutiveFailures ?? 0;

    if (!cfg.isActive) {
      return {
        platform: cfg.platform,
        isActive: false,
        lastRunAt: cfg.lastRunAt,
        lastRunStatus: cfg.lastRunStatus,
        consecutiveFailures: failures,
        circuitBreakerOpen: failures >= 5,
        runs24h: 0,
        failures24h: 0,
        failureRate: 0,
        status: "inactief" as const,
      };
    }

    const stats = statsMap.get(cfg.platform);
    const runs24h = stats?.total ?? 0;
    const failures24h = stats?.failures ?? 0;
    const failureRate = runs24h > 0 ? failures24h / runs24h : 0;

    let status: PlatformHealth["status"] = "gezond";
    if (failures24h > 3) {
      status = "kritiek";
    } else if (failures24h > 0) {
      status = "waarschuwing";
    }

    // Promote to kritiek if circuit breaker is open
    if (failures >= 5) {
      status = "kritiek";
    }

    return {
      platform: cfg.platform,
      isActive: cfg.isActive,
      lastRunAt: cfg.lastRunAt,
      lastRunStatus: cfg.lastRunStatus,
      consecutiveFailures: failures,
      circuitBreakerOpen: failures >= 5,
      runs24h,
      failures24h,
      failureRate: Math.round(failureRate * 100) / 100,
      status,
    };
  });

  const overall: HealthReport["overall"] = health.some((h) => h.status === "kritiek")
    ? "kritiek"
    : health.some((h) => h.status === "waarschuwing")
      ? "waarschuwing"
      : "gezond";

  return { data: health, overall };
}

// ========== Auth Config Encryption ==========

/** Encrypt een auth config object naar een versleutelde string */
export function encryptAuthConfig(config: Record<string, string>): string {
  return encrypt(JSON.stringify(config));
}

/** Decrypt een versleutelde string terug naar auth config object */
export function decryptAuthConfig(encoded: string): Record<string, string> {
  return JSON.parse(decrypt(encoded));
}

/**
 * Detecteer of een waarde al versleuteld is.
 * Encrypted waarden zijn base64 en minimaal 32 bytes (IV + tag).
 * Plaintext JSON begint altijd met '{'.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || value.length === 0) return false;
  // Plaintext JSON begint met '{' of '['
  if (value.startsWith("{") || value.startsWith("[")) return false;
  // Controleer of het geldige base64 is met minimale lengte (IV + tag = 32 bytes = 44 base64 chars)
  if (value.length < 44) return false;
  try {
    const buf = Buffer.from(value, "base64");
    // Re-encode en vergelijk — ongeldige base64 geeft een ander resultaat
    return buf.toString("base64") === value;
  } catch {
    return false;
  }
}
