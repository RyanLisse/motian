import { ArrowDownLeft, ArrowUpRight, Filter, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { and, db, desc, eq, isNull, sql } from "@/src/db";
import { applications, candidates, jobs, messages } from "@/src/db/schema";
import { parsePagination } from "@/src/lib/pagination";
import { channelLabels, directionLabels, MessageCard } from "./_components/message-card";

export const dynamic = "force-dynamic";

/** Search and pagination via URL (Next.js Learn: adding-search-and-pagination). */
interface Props {
  searchParams: Promise<{
    direction?: string;
    channel?: string;
    pagina?: string;
    page?: string;
    limit?: string;
    perPage?: string;
  }>;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const directionFilter = params.direction ?? "";
  const channelFilter = params.channel ?? "";

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) urlParams.set(key, v);
  }
  const { page, limit, offset } = parsePagination(urlParams, {
    limit: DEFAULT_PER_PAGE,
    maxLimit: MAX_PER_PAGE,
  });

  // KPI counts
  const directionCounts = await db
    .select({
      direction: messages.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(isNull(messages.deletedAt))
    .groupBy(messages.direction);

  let totalMessages = 0;
  const dirMap: Record<string, number> = {};
  for (const row of directionCounts) {
    dirMap[row.direction] = row.count;
    totalMessages += row.count;
  }

  // Query messages with joins
  const conditions = [isNull(messages.deletedAt)];
  if (directionFilter && ["inbound", "outbound"].includes(directionFilter)) {
    conditions.push(eq(messages.direction, directionFilter));
  }
  if (channelFilter && ["email", "phone", "platform"].includes(channelFilter)) {
    conditions.push(eq(messages.channel, channelFilter));
  }
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        message: messages,
        candidateName: candidates.name,
        jobTitle: jobs.title,
      })
      .from(messages)
      .innerJoin(applications, eq(messages.applicationId, applications.id))
      .leftJoin(candidates, eq(applications.candidateId, candidates.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(messages.sentAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(messages).where(where),
  ]);

  const totalFiltered = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalFiltered / limit) || 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Berichten</h1>
          <p className="text-sm text-muted-foreground mt-1">Communicatie met kandidaten</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <KPICard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Totaal berichten"
            value={totalMessages}
            compact
          />
          <KPICard
            icon={<ArrowDownLeft className="h-4 w-4" />}
            label="Inkomend"
            value={dirMap.inbound ?? 0}
            compact
          />
          <KPICard
            icon={<ArrowUpRight className="h-4 w-4" />}
            label="Uitgaand"
            value={dirMap.outbound ?? 0}
            compact
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <FilterTabs
            options={[
              { value: "", label: "Alle" },
              { value: "inbound", label: directionLabels.inbound },
              { value: "outbound", label: directionLabels.outbound },
            ]}
            activeValue={directionFilter}
            buildHref={(v) => {
              const p = new URLSearchParams();
              if (v) p.set("direction", v);
              if (channelFilter) p.set("channel", channelFilter);
              const qs = p.toString();
              return `/messages${qs ? `?${qs}` : ""}`;
            }}
            variant="subtle"
            icon={<Filter className="h-4 w-4 text-muted-foreground" />}
          />
          <FilterTabs
            options={[
              { value: "email", label: channelLabels.email },
              { value: "phone", label: channelLabels.phone },
              { value: "platform", label: channelLabels.platform },
            ]}
            activeValue={channelFilter}
            buildHref={(v) => {
              const p = new URLSearchParams();
              if (directionFilter) p.set("direction", directionFilter);
              if (v) p.set("channel", v);
              const qs = p.toString();
              return `/messages${qs ? `?${qs}` : ""}`;
            }}
            variant="subtle"
          />
        </div>

        {/* Results */}
        {rows.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-12 w-12" />}
            title="Geen berichten gevonden"
            subtitle="Berichten worden hier getoond zodra er communicatie plaatsvindt"
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {totalFiltered} bericht{totalFiltered !== 1 ? "en" : ""} gevonden — Pagina {page} van{" "}
              {totalPages}
            </p>
            <div className="grid gap-3">
              {rows.map((row) => (
                <MessageCard
                  key={row.message.id}
                  message={row.message}
                  candidateName={row.candidateName}
                  jobTitle={row.jobTitle}
                />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(pg) => {
                const p = new URLSearchParams();
                if (directionFilter) p.set("direction", directionFilter);
                if (channelFilter) p.set("channel", channelFilter);
                p.set("pagina", String(pg));
                if (limit !== DEFAULT_PER_PAGE) p.set("limit", String(limit));
                return `/messages?${p.toString()}`;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
