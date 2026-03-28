type TypesenseJobDocumentInput = {
  id: string;
  title: string;
  externalId?: string | null;
  searchText?: string | null;
  platform?: string | null;
  company?: string | null;
  endClient?: string | null;
  status?: string | null;
  province?: string | null;
  contractType?: string | null;
  workArrangement?: string | null;
  categories?: string[] | null;
  rateMin?: number | null;
  rateMax?: number | null;
  hoursPerWeek?: number | null;
  minHoursPerWeek?: number | null;
  applicationDeadline?: Date | null;
  startDate?: Date | null;
  postedAt?: Date | null;
  scrapedAt?: Date | null;
};

type TypesenseCandidateDocumentInput = {
  id: string;
  name: string;
  role?: string | null;
  location?: string | null;
  skills?: string[] | null;
  matchingStatus?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function normalizeString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function toUnixTimestamp(value: Date | null | undefined): number | undefined {
  return value instanceof Date ? value.getTime() : undefined;
}

function compactUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function toTypesenseJobDocument(input: TypesenseJobDocumentInput) {
  return compactUndefined({
    id: input.id,
    title: input.title,
    searchText: normalizeString(input.searchText) ?? input.title,
    platform: normalizeString(input.platform),
    company: normalizeString(input.company),
    endClient: normalizeString(input.endClient),
    status: normalizeString(input.status),
    province: normalizeString(input.province),
    contractType: normalizeString(input.contractType),
    workArrangement: normalizeString(input.workArrangement),
    categories: normalizeStringArray(input.categories),
    rateMin: input.rateMin ?? undefined,
    rateMax: input.rateMax ?? undefined,
    hoursPerWeek: input.hoursPerWeek ?? undefined,
    minHoursPerWeek: input.minHoursPerWeek ?? undefined,
    applicationDeadlineTs: toUnixTimestamp(input.applicationDeadline),
    startDateTs: toUnixTimestamp(input.startDate),
    postedAtTs: toUnixTimestamp(input.postedAt),
    scrapedAtTs: toUnixTimestamp(input.scrapedAt),
  });
}

export function toTypesenseCandidateDocument(input: TypesenseCandidateDocumentInput) {
  const skills = normalizeStringArray(input.skills);
  const searchText = [
    input.name,
    normalizeString(input.role),
    normalizeString(input.location),
    ...skills,
  ]
    .filter(Boolean)
    .join(" ");

  return compactUndefined({
    id: input.id,
    name: input.name,
    role: normalizeString(input.role),
    location: normalizeString(input.location),
    skills,
    searchText,
    matchingStatus: normalizeString(input.matchingStatus),
    createdAtTs: toUnixTimestamp(input.createdAt),
    updatedAtTs: toUnixTimestamp(input.updatedAt),
  });
}
