import { and, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "../../db";
import { applications, jobSkills, jobs } from "../../db/schema";
import {
  getHoursRangeForBucket,
  getProvinceAnchor,
  getProvincesForRegion,
  type OpdrachtenHoursBucket,
  type OpdrachtenRegion,
} from "../../lib/opdrachten-filters";
import { getJobStatusCondition, type JobStatus } from "./filters";

export type SharedJobFilterOptions = {
  platforms?: string[];
  platform?: string;
  company?: string;
  endClient?: string;
  escoUri?: string;
  category?: string;
  categories?: string[];
  status?: JobStatus;
  province?: string;
  region?: OpdrachtenRegion;
  regions?: OpdrachtenRegion[];
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  hasDescription?: boolean;
  postedAfter?: Date | string;
  postedBefore?: Date | string;
  deadlineAfter?: Date | string;
  deadlineBefore?: Date | string;
  startDateAfter?: Date | string;
  startDateBefore?: Date | string;
  hoursPerWeekBucket?: OpdrachtenHoursBucket;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  radiusKm?: number;
  /** Vacatures with at least one non-rejected sollicitatie (active pipeline). */
  onlyWithActivePipeline?: boolean;
};

export function buildJobFilterConditions(opts: SharedJobFilterOptions = {}) {
  const conditions = [getJobStatusCondition(opts.status ?? "open")];
  const selectedPlatforms = [
    ...new Set([...(opts.platforms ?? []), ...(opts.platform ? [opts.platform] : [])]),
  ];
  const categories = [
    ...new Set([...(opts.categories ?? []), ...(opts.category ? [opts.category] : [])]),
  ];
  const selectedRegions = [
    ...new Set([...(opts.regions ?? []), ...(opts.region ? [opts.region] : [])]),
  ];

  if (selectedPlatforms.length === 1) {
    const onlyPlatform = selectedPlatforms[0];
    if (onlyPlatform) conditions.push(eq(jobs.platform, onlyPlatform));
  } else if (selectedPlatforms.length > 1) {
    conditions.push(inArray(jobs.platform, selectedPlatforms));
  }
  if (opts.company) conditions.push(eq(jobs.company, opts.company));

  if (opts.endClient) {
    const endClientCondition = or(
      eq(jobs.endClient, opts.endClient),
      and(isNull(jobs.endClient), eq(jobs.company, opts.endClient)),
    );
    if (endClientCondition) conditions.push(endClientCondition);
  }

  if (opts.escoUri) {
    conditions.push(
      sql`exists (select 1 from ${jobSkills} where ${jobSkills.jobId} = ${jobs.id} and ${jobSkills.escoUri} = ${opts.escoUri})`,
    );
  }

  if (categories.length > 0) {
    const categoryCondition = or(
      ...categories.map((category) => sql`${jobs.categories} ? ${category}`),
    );

    if (categoryCondition) {
      conditions.push(categoryCondition);
    }
  }

  if (selectedRegions.length > 0) {
    const regionProvinces = [
      ...new Set(selectedRegions.flatMap((region) => getProvincesForRegion(region))),
    ];

    if (regionProvinces.length > 0) {
      const regionCondition = or(...regionProvinces.map((province) => eq(jobs.province, province)));

      if (regionCondition) {
        conditions.push(regionCondition);
      }
    }
  }

  if (opts.province) {
    conditions.push(eq(jobs.province, opts.province));
  }

  if (opts.rateMin != null) conditions.push(gte(jobs.rateMax, opts.rateMin));
  if (opts.rateMax != null) conditions.push(lte(jobs.rateMin, opts.rateMax));
  if (opts.contractType) conditions.push(eq(jobs.contractType, opts.contractType));
  if (opts.workArrangement) conditions.push(eq(jobs.workArrangement, opts.workArrangement));
  if (opts.hasDescription) conditions.push(isNotNull(jobs.description));

  if (opts.postedAfter) conditions.push(gte(jobs.postedAt, new Date(opts.postedAfter)));
  if (opts.postedBefore) conditions.push(lte(jobs.postedAt, new Date(opts.postedBefore)));
  if (opts.deadlineAfter)
    conditions.push(gte(jobs.applicationDeadline, new Date(opts.deadlineAfter)));
  if (opts.deadlineBefore)
    conditions.push(lte(jobs.applicationDeadline, new Date(opts.deadlineBefore)));
  if (opts.startDateAfter) conditions.push(gte(jobs.startDate, new Date(opts.startDateAfter)));
  if (opts.startDateBefore) conditions.push(lte(jobs.startDate, new Date(opts.startDateBefore)));

  const explicitHoursRange = opts.minHoursPerWeek != null || opts.maxHoursPerWeek != null;
  const hoursRange = explicitHoursRange
    ? { min: opts.minHoursPerWeek, max: opts.maxHoursPerWeek }
    : opts.hoursPerWeekBucket
      ? getHoursRangeForBucket(opts.hoursPerWeekBucket)
      : undefined;

  if (hoursRange) {
    const rangeStart = sql`coalesce(${jobs.minHoursPerWeek}, ${jobs.hoursPerWeek})`;
    const rangeEnd = sql`coalesce(${jobs.hoursPerWeek}, ${jobs.minHoursPerWeek})`;

    if (hoursRange.min != null && hoursRange.max != null) {
      conditions.push(sql`${rangeEnd} >= ${hoursRange.min} and ${rangeStart} <= ${hoursRange.max}`);
    } else {
      if (hoursRange.min != null) conditions.push(sql`${rangeEnd} >= ${hoursRange.min}`);
      if (hoursRange.max != null) conditions.push(sql`${rangeStart} <= ${hoursRange.max}`);
    }
  }

  if (opts.onlyWithActivePipeline) {
    conditions.push(sql`
      exists (
        select 1 from ${applications}
        where ${applications.jobId} = ${jobs.id}
          and ${applications.deletedAt} is null
          and ${applications.stage} <> 'rejected'
      )
    `);
  }

  if (opts.radiusKm != null && opts.radiusKm > 0 && opts.province) {
    const anchor = getProvinceAnchor(opts.province);
    if (anchor) {
      conditions.push(sql`
        ${jobs.latitude} is not null
        and ${jobs.longitude} is not null
        and (
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians(${anchor.latitude})) * cos(radians(${jobs.latitude})) *
                cos(radians(${jobs.longitude}) - radians(${anchor.longitude})) +
                sin(radians(${anchor.latitude})) * sin(radians(${jobs.latitude}))
              )
            )
          )
        ) <= ${opts.radiusKm}
      `);
    }
  }

  return conditions;
}
