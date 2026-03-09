import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { applications, candidates, jobs } from "@/src/db/schema";
import {
  getJobStatusCondition,
  getVisibleVacancyCondition,
  normalizeJobStatusFilter,
} from "@/src/services/jobs/filters";

export const SALESFORCE_FEED_ENTITIES = ["jobs", "candidates", "applications"] as const;

export type SalesforceFeedEntity = (typeof SALESFORCE_FEED_ENTITIES)[number];
export type SalesforceObjectType = "Candidate__c" | "Job__c" | "Application__c";

type SalesforceValue = boolean | Date | number | string | null | undefined;

export type SalesforceFeedRecord = {
  objectType: SalesforceObjectType;
  fields: Record<string, SalesforceValue>;
};

export type SalesforceFeedQuery = {
  entity: SalesforceFeedEntity;
  id?: string;
  updatedSince?: Date;
  status?: string;
  limit: number;
  offset: number;
};

export function parseSalesforceFeedEntity(value?: string | null): SalesforceFeedEntity | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  return SALESFORCE_FEED_ENTITIES.includes(normalized as SalesforceFeedEntity)
    ? (normalized as SalesforceFeedEntity)
    : undefined;
}

export function parseUpdatedSinceParam(value?: string | null): Date | null | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDelimitedString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);

  return items.length > 0 ? items.join("; ") : null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatXmlValue(value: Exclude<SalesforceValue, null | undefined>): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function hasXmlValue(
  entry: [string, SalesforceValue],
): entry is [string, Exclude<SalesforceValue, null | undefined>] {
  return entry[1] !== null && entry[1] !== undefined;
}

export function buildSalesforceFeedXml(records: SalesforceFeedRecord[]): string {
  const entries = records
    .map((record) => {
      const fields = Object.entries(record.fields)
        .filter(hasXmlValue)
        .map(([key, value]) => `    <${key}>${escapeXml(formatXmlValue(value))}</${key}>`)
        .join("\n");

      return [`  <sObject>`, `    <type>${record.objectType}</type>`, fields, `  </sObject>`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sObjects>${entries ? `\n${entries}\n` : ""}</sObjects>`;
}

function buildApplicationName(row: {
  candidateName: string | null;
  candidateId: string | null;
  jobTitle: string | null;
  jobId: string | null;
}) {
  const candidateLabel = row.candidateName ?? row.candidateId ?? "Unknown candidate";
  const jobLabel = row.jobTitle ?? row.jobId ?? "Unknown job";
  return `${candidateLabel} / ${jobLabel}`;
}

async function getApplicationsFeed(query: SalesforceFeedQuery): Promise<SalesforceFeedRecord[]> {
  const conditions = [isNull(applications.deletedAt)];

  if (query.id) conditions.push(eq(applications.id, query.id));
  if (query.status) conditions.push(eq(applications.stage, query.status));
  if (query.updatedSince) conditions.push(gte(applications.updatedAt, query.updatedSince));

  const rows = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      candidateId: applications.candidateId,
      matchId: applications.matchId,
      stage: applications.stage,
      source: applications.source,
      notes: applications.notes,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      jobTitle: jobs.title,
      candidateName: candidates.name,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(...conditions))
    .orderBy(desc(applications.updatedAt))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map((row) => ({
    objectType: "Application__c",
    fields: {
      Id: row.id,
      Name: buildApplicationName(row),
      JobId__c: row.jobId,
      JobTitle__c: row.jobTitle,
      CandidateId__c: row.candidateId,
      CandidateName__c: row.candidateName,
      MatchId__c: row.matchId,
      Status__c: row.stage,
      Source__c: row.source,
      Notes__c: row.notes,
      CreatedDate: row.createdAt,
      LastModifiedDate: row.updatedAt,
    },
  }));
}

async function getCandidatesFeed(query: SalesforceFeedQuery): Promise<SalesforceFeedRecord[]> {
  const conditions = [isNull(candidates.deletedAt)];

  if (query.id) conditions.push(eq(candidates.id, query.id));
  if (query.status) conditions.push(eq(candidates.matchingStatus, query.status));
  if (query.updatedSince) conditions.push(gte(candidates.updatedAt, query.updatedSince));

  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      email: candidates.email,
      phone: candidates.phone,
      role: candidates.role,
      location: candidates.location,
      province: candidates.province,
      skills: candidates.skills,
      linkedinUrl: candidates.linkedinUrl,
      headline: candidates.headline,
      profileSummary: candidates.profileSummary,
      source: candidates.source,
      hourlyRate: candidates.hourlyRate,
      availability: candidates.availability,
      matchingStatus: candidates.matchingStatus,
      consentGranted: candidates.consentGranted,
      createdAt: candidates.createdAt,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .where(and(...conditions))
    .orderBy(desc(candidates.updatedAt))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map((row) => ({
    objectType: "Candidate__c",
    fields: {
      Id: row.id,
      Name: row.name,
      Email__c: row.email,
      Phone__c: row.phone,
      Role__c: row.role,
      Location__c: row.location,
      Province__c: row.province,
      Skills__c: toDelimitedString(row.skills),
      LinkedInUrl__c: row.linkedinUrl,
      Headline__c: row.headline,
      ProfileSummary__c: row.profileSummary,
      Source__c: row.source,
      HourlyRate__c: row.hourlyRate,
      Availability__c: row.availability,
      Status__c: row.matchingStatus,
      ConsentGranted__c: row.consentGranted,
      CreatedDate: row.createdAt,
      LastModifiedDate: row.updatedAt,
    },
  }));
}

function getJobStatusFilter(status?: string) {
  if (!status) return undefined;

  const normalized = normalizeJobStatusFilter(status);
  if (normalized) return normalized;

  const trimmed = status.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function getJobsFeed(query: SalesforceFeedQuery): Promise<SalesforceFeedRecord[]> {
  const status = getJobStatusFilter(query.status);
  const hasExplicitStatus = status !== undefined;
  const statusCondition =
    status === undefined
      ? undefined
      : status === "all"
        ? undefined
        : status === "open" || status === "closed" || status === "archived"
          ? getJobStatusCondition(status)
          : eq(jobs.status, status);
  const conditions = [
    query.id || hasExplicitStatus ? undefined : getVisibleVacancyCondition(),
    query.id ? eq(jobs.id, query.id) : undefined,
    statusCondition,
    query.updatedSince ? gte(jobs.scrapedAt, query.updatedSince) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

  const rows = await db
    .select({
      id: jobs.id,
      platform: jobs.platform,
      externalId: jobs.externalId,
      externalUrl: jobs.externalUrl,
      clientReferenceCode: jobs.clientReferenceCode,
      title: jobs.title,
      company: jobs.company,
      endClient: jobs.endClient,
      location: jobs.location,
      province: jobs.province,
      description: jobs.description,
      status: jobs.status,
      rateMin: jobs.rateMin,
      rateMax: jobs.rateMax,
      currency: jobs.currency,
      positionsAvailable: jobs.positionsAvailable,
      startDate: jobs.startDate,
      endDate: jobs.endDate,
      applicationDeadline: jobs.applicationDeadline,
      postedAt: jobs.postedAt,
      contractType: jobs.contractType,
      workArrangement: jobs.workArrangement,
      scrapedAt: jobs.scrapedAt,
    })
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map((row) => ({
    objectType: "Job__c",
    fields: {
      Id: row.id,
      Name: row.title,
      Platform__c: row.platform,
      ExternalId__c: row.externalId,
      ExternalUrl__c: row.externalUrl,
      ClientReferenceCode__c: row.clientReferenceCode,
      Company__c: row.company,
      EndClient__c: row.endClient,
      Location__c: row.location,
      Province__c: row.province,
      Description__c: row.description,
      Status__c: row.status,
      RateMin__c: row.rateMin,
      RateMax__c: row.rateMax,
      Currency__c: row.currency,
      PositionsAvailable__c: row.positionsAvailable,
      StartDate__c: row.startDate,
      EndDate__c: row.endDate,
      ApplicationDeadline__c: row.applicationDeadline,
      PostedAt__c: row.postedAt,
      ContractType__c: row.contractType,
      WorkArrangement__c: row.workArrangement,
      LastModifiedDate: row.scrapedAt,
    },
  }));
}

export async function getSalesforceFeed(
  query: SalesforceFeedQuery,
): Promise<SalesforceFeedRecord[]> {
  switch (query.entity) {
    case "jobs":
      return getJobsFeed(query);
    case "candidates":
      return getCandidatesFeed(query);
    default:
      return getApplicationsFeed(query);
  }
}
