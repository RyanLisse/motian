export const LOCAL_DATA_CHANGE_EVENT = "motian-data-changed";
export const REFRESH_DEBOUNCE_MS = 500;

export const REFRESH_TAG_VALUES = [
  "all",
  "candidates",
  "matches",
  "pipeline",
  "jobs",
  "interviews",
  "messages",
  "scrapers",
] as const;

export type RefreshTag = (typeof REFRESH_TAG_VALUES)[number];

export type DataRefreshEvent = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  tags: RefreshTag[];
};

const REFRESH_TAG_SET = new Set<RefreshTag>(REFRESH_TAG_VALUES);

const EVENT_TAGS: Array<[prefix: string, tags: RefreshTag[]]> = [
  ["candidate:", ["candidates"]],
  ["match:", ["matches", "candidates", "jobs", "pipeline"]],
  ["matches:", ["matches", "candidates", "jobs", "pipeline"]],
  ["application:", ["pipeline", "candidates", "jobs"]],
  ["interview:", ["interviews", "pipeline", "candidates"]],
  ["message:", ["messages", "pipeline", "candidates"]],
  ["job:", ["jobs", "matches", "pipeline"]],
  ["scrape:", ["scrapers", "jobs"]],
  ["platform:", ["scrapers", "jobs"]],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeRefreshTags(tags: readonly unknown[] | null | undefined): RefreshTag[] {
  if (!tags || tags.length === 0) return [];

  const normalized = new Set<RefreshTag>();

  for (const value of tags) {
    if (typeof value !== "string") continue;
    if (!REFRESH_TAG_SET.has(value as RefreshTag)) continue;
    normalized.add(value as RefreshTag);
  }

  return Array.from(normalized);
}

export function deriveRefreshTags(type: string): RefreshTag[] {
  for (const [prefix, tags] of EVENT_TAGS) {
    if (type.startsWith(prefix)) return tags;
  }

  return [];
}

export function normalizeDataRefreshEvent(value: unknown): DataRefreshEvent | null {
  if (typeof value === "string") {
    try {
      return normalizeDataRefreshEvent(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value) || typeof value.type !== "string") return null;

  const tags = normalizeRefreshTags(Array.isArray(value.tags) ? value.tags : undefined);

  return {
    type: value.type,
    data: isRecord(value.data) ? value.data : {},
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date().toISOString(),
    tags: tags.length > 0 ? tags : deriveRefreshTags(value.type),
  };
}

export function mergeRefreshTags(
  events: ReadonlyArray<Pick<DataRefreshEvent, "tags">>,
): RefreshTag[] {
  return normalizeRefreshTags(events.flatMap((event) => event.tags));
}

export function shouldRefreshPath(pathname: string, tags: readonly RefreshTag[]): boolean {
  if (tags.length === 0) return false;
  if (tags.includes("all")) return true;

  const routeTags = pathname.startsWith("/kandidaten")
    ? (["candidates", "matches", "pipeline"] as const)
    : pathname.startsWith("/vacatures") || pathname.startsWith("/opdrachten")
      ? (["jobs", "matches", "pipeline"] as const)
      : pathname.startsWith("/pipeline")
        ? (["pipeline", "matches", "candidates", "jobs"] as const)
        : pathname.startsWith("/interviews")
          ? (["interviews", "pipeline", "candidates"] as const)
          : pathname.startsWith("/messages")
            ? (["messages", "pipeline", "candidates"] as const)
            : pathname.startsWith("/overzicht")
              ? (["candidates", "matches", "pipeline", "jobs", "interviews", "messages"] as const)
              : pathname.startsWith("/automatisering") || pathname.startsWith("/scraper")
                ? (["scrapers", "jobs"] as const)
                : ([] as const);

  return routeTags.some((tag) => tags.includes(tag));
}
