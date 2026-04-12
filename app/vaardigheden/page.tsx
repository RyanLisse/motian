import { Tags } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { candidateSkillsV2, candidates, db, desc, isNull, skills, sql } from "@/src/db";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface SkillRow {
  slug: string;
  name: string;
  candidateCount: number;
}

async function getSkillAggregation(): Promise<SkillRow[]> {
  const rows = await db
    .select({
      slug: skills.slug,
      name: skills.name,
      candidateCount: sql<number>`count(distinct ${candidateSkillsV2.candidateId})`.as(
        "candidate_count",
      ),
    })
    .from(candidateSkillsV2)
    .innerJoin(skills, sql`${candidateSkillsV2.skillId} = ${skills.id}`)
    .innerJoin(candidates, sql`${candidateSkillsV2.candidateId} = ${candidates.id}`)
    .where(isNull(candidates.deletedAt))
    .groupBy(skills.slug, skills.name)
    .orderBy(desc(sql`candidate_count`));

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    candidateCount: Number(r.candidateCount),
  }));
}

function VaardighedenSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`badge-${i}`} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`row-${i}`} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function VaardighedenContent() {
  const skillRows = await getSkillAggregation();

  const totalSkills = skillRows.length;
  const totalMappings = skillRows.reduce((sum, skill) => sum + skill.candidateCount, 0);
  const topSkill = skillRows[0];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          title="Vaardigheden"
          description="Overzicht van alle herkenbare skills in de kandidatenpool"
          breadcrumbs={[
            { href: "/overzicht", label: "Dashboard" },
            { href: "/vaardigheden", label: "Vaardigheden" },
          ]}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Unieke vaardigheden</p>
            <p className="text-xl font-bold text-foreground">{totalSkills}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Totaal koppelingen</p>
            <p className="text-xl font-bold text-foreground">{totalMappings}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Populairste vaardigheid</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {topSkill ? topSkill.name : "—"}
            </p>
          </div>
        </div>

        {skillRows.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-8 w-8" />}
            title="Geen vaardigheden gevonden"
            subtitle="Er zijn nog geen skills gekoppeld aan kandidaten"
          />
        ) : (
          <>
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Top vaardigheden</h2>
              <div className="flex flex-wrap gap-2">
                {skillRows.slice(0, 20).map((skill) => (
                  <Link
                    key={skill.slug}
                    href={`/kandidaten?vaardigheid=${encodeURIComponent(skill.slug)}`}
                  >
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                    >
                      {skill.name}
                      <span className="ml-1.5 text-primary/60">{skill.candidateCount}</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Alle vaardigheden ({totalSkills})
              </h2>
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {skillRows.map((skill, index) => (
                  <Link
                    key={skill.slug}
                    href={`/kandidaten?vaardigheid=${encodeURIComponent(skill.slug)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{skill.slug}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 ml-3 text-xs border-border text-muted-foreground bg-transparent"
                    >
                      {skill.candidateCount}{" "}
                      {skill.candidateCount === 1 ? "kandidaat" : "kandidaten"}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default function VaardighedenPage() {
  return (
    <Suspense fallback={<VaardighedenSkeleton />}>
      <VaardighedenContent />
    </Suspense>
  );
}
