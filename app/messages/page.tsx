import { and, desc, eq, sql } from "drizzle-orm";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Globe,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { applications, candidates, jobs, messages } from "@/src/db/schema";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    direction?: string;
    channel?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

const channelColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  phone: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  platform: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  platform: Globe,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  phone: "Telefoon",
  platform: "Platform",
};

const directionLabels: Record<string, string> = {
  inbound: "Inkomend",
  outbound: "Uitgaand",
};

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const directionFilter = params.direction ?? "";
  const channelFilter = params.channel ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  // KPI counts
  const directionCounts = await db
    .select({
      direction: messages.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .groupBy(messages.direction);

  let totalMessages = 0;
  const dirMap: Record<string, number> = {};
  for (const row of directionCounts) {
    dirMap[row.direction] = row.count;
    totalMessages += row.count;
  }

  // Query messages with joins
  const conditions = [];
  if (directionFilter && ["inbound", "outbound"].includes(directionFilter)) {
    conditions.push(eq(messages.direction, directionFilter));
  }
  if (channelFilter && ["email", "phone", "platform"].includes(channelFilter)) {
    conditions.push(eq(messages.channel, channelFilter));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(messages).where(where),
  ]);

  const totalFiltered = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalFiltered / PER_PAGE);

  return (
    <main className="flex-1 overflow-y-auto bg-[#0d0d0d]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#ececec]">Berichten</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">Communicatie met kandidaten</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Totaal berichten", value: totalMessages, icon: MessageSquare },
            { label: "Inkomend", value: dirMap.inbound ?? 0, icon: ArrowDownLeft },
            { label: "Uitgaand", value: dirMap.outbound ?? 0, icon: ArrowUpRight },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-4 w-4 text-[#6b6b6b]" />
                <span className="text-xs text-[#8e8e8e]">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-[#ececec]">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#6b6b6b]" />
            <Link
              href="/messages"
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                !directionFilter
                  ? "bg-[#10a37f]/10 text-[#10a37f] font-medium"
                  : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
              }`}
            >
              Alle
            </Link>
            {(["inbound", "outbound"] as const).map((d) => (
              <Link
                key={d}
                href={`/messages?direction=${d}${channelFilter ? `&channel=${channelFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  directionFilter === d
                    ? "bg-[#10a37f]/10 text-[#10a37f] font-medium"
                    : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
                }`}
              >
                {directionLabels[d]}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {(["email", "phone", "platform"] as const).map((c) => (
              <Link
                key={c}
                href={`/messages?channel=${c}${directionFilter ? `&direction=${directionFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  channelFilter === c
                    ? "bg-[#10a37f]/10 text-[#10a37f] font-medium"
                    : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
                }`}
              >
                {channelLabels[c]}
              </Link>
            ))}
          </div>
        </div>

        {/* Results */}
        {rows.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="h-12 w-12 text-[#2d2d2d] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#ececec] mb-2">Geen berichten gevonden</h2>
            <p className="text-sm text-[#8e8e8e]">
              Berichten worden hier getoond zodra er communicatie plaatsvindt
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#8e8e8e]">
              {totalFiltered} bericht{totalFiltered !== 1 ? "en" : ""} gevonden — Pagina {page} van{" "}
              {totalPages}
            </p>
            <div className="grid gap-3">
              {rows.map((row) => {
                const ChannelIcon = channelIcons[row.message.channel] ?? Mail;
                const isInbound = row.message.direction === "inbound";
                return (
                  <div
                    key={row.message.id}
                    className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-4 hover:border-[#10a37f]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isInbound ? (
                            <ArrowDownLeft className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-[#10a37f] shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-[#ececec] truncate">
                            {row.message.subject ??
                              row.message.body.substring(0, 80) +
                                (row.message.body.length > 80 ? "..." : "")}
                          </span>
                        </div>
                        <p className="text-xs text-[#6b6b6b] ml-6">
                          {row.candidateName ?? "Onbekend"}{" "}
                          {row.jobTitle ? `· ${row.jobTitle}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-xs ${channelColors[row.message.channel] ?? ""}`}
                        >
                          <ChannelIcon className="h-3 w-3 mr-1" />
                          {channelLabels[row.message.channel] ?? row.message.channel}
                        </Badge>
                      </div>
                    </div>
                    {row.message.subject && (
                      <p className="mt-2 text-xs text-[#8e8e8e] ml-6 line-clamp-2">
                        {row.message.body.substring(0, 120)}
                        {row.message.body.length > 120 ? "..." : ""}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-[#6b6b6b] ml-6">
                      {row.message.sentAt &&
                        new Date(row.message.sentAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {page > 1 && (
                  <Link
                    href={`/messages?${directionFilter ? `direction=${directionFilter}&` : ""}${channelFilter ? `channel=${channelFilter}&` : ""}pagina=${page - 1}`}
                    className="px-3 py-1.5 rounded-md text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    ← Vorige
                  </Link>
                )}
                <span className="text-sm text-[#6b6b6b]">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/messages?${directionFilter ? `direction=${directionFilter}&` : ""}${channelFilter ? `channel=${channelFilter}&` : ""}pagina=${page + 1}`}
                    className="px-3 py-1.5 rounded-md text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
                  >
                    Volgende →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
