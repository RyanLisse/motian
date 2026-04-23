import { sql } from "drizzle-orm";
import { db } from "../src/db";

function fmtUsd(micros: bigint | number): string {
  const n = typeof micros === "bigint" ? Number(micros) : micros;
  return `$${(n / 1_000_000).toFixed(2)}`;
}

(async () => {
  console.log("=== AI cost per month (ai_usage) ===");
  const byMonth = await db.execute(sql`
    select
      to_char(created_at, 'YYYY-MM')   as month,
      count(*)::int                    as calls,
      coalesce(sum(input_tokens), 0)   as input_tokens,
      coalesce(sum(output_tokens), 0)  as output_tokens,
      coalesce(sum(total_tokens), 0)   as total_tokens,
      coalesce(sum(cost_usd_micros), 0) as cost_micros
    from ai_usage
    group by 1
    order by 1 desc
    limit 12
  `);
  const monthRows = (byMonth as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  if (monthRows.length === 0) {
    console.log("  (no rows yet — start a chat or run an AI tool to populate)");
  } else {
    console.table(
      monthRows.map((r) => ({
        month: r.month,
        calls: Number(r.calls),
        input: Number(r.input_tokens).toLocaleString(),
        output: Number(r.output_tokens).toLocaleString(),
        total: Number(r.total_tokens).toLocaleString(),
        cost: fmtUsd(Number(r.cost_micros)),
      })),
    );
  }

  console.log("\n=== AI cost per model (last 30 days) ===");
  const byModel = await db.execute(sql`
    select
      model,
      provider,
      count(*)::int                     as calls,
      coalesce(sum(total_tokens), 0)    as total_tokens,
      coalesce(sum(cost_usd_micros), 0) as cost_micros
    from ai_usage
    where created_at >= now() - interval '30 days'
    group by model, provider
    order by cost_micros desc
  `);
  const modelRows = (byModel as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  if (modelRows.length === 0) {
    console.log("  (no rows in last 30 days)");
  } else {
    console.table(
      modelRows.map((r) => ({
        provider: r.provider,
        model: r.model,
        calls: Number(r.calls),
        tokens: Number(r.total_tokens).toLocaleString(),
        cost: fmtUsd(Number(r.cost_micros)),
      })),
    );
  }

  console.log("\n=== AI cost per flow (last 30 days) ===");
  const byFlow = await db.execute(sql`
    select
      flow,
      count(*)::int                     as calls,
      coalesce(sum(total_tokens), 0)    as total_tokens,
      coalesce(sum(cost_usd_micros), 0) as cost_micros
    from ai_usage
    where created_at >= now() - interval '30 days'
    group by flow
    order by cost_micros desc
  `);
  const flowRows = (byFlow as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  if (flowRows.length === 0) {
    console.log("  (no rows in last 30 days)");
  } else {
    console.table(
      flowRows.map((r) => ({
        flow: r.flow,
        calls: Number(r.calls),
        tokens: Number(r.total_tokens).toLocaleString(),
        cost: fmtUsd(Number(r.cost_micros)),
      })),
    );
  }
  process.exit(0);
})();
