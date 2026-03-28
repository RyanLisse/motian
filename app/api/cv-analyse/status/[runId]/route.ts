import { runs } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;

  try {
    const run = await runs.retrieve(runId);

    // Use no-store for non-terminal statuses, cache for terminal statuses
    const isTerminal = run.isCompleted || run.isFailed;
    const cacheControl = isTerminal ? "private, max-age=15" : "no-store";

    return Response.json(
      {
        id: run.id,
        status: run.status,
        isCompleted: run.isCompleted,
        isExecuting: run.isExecuting,
        isSuccess: run.isSuccess,
        isFailed: run.isFailed,
        metadata: run.metadata ?? null,
        output: run.output ?? null,
        error: run.error?.message ?? null,
      },
      {
        headers: { "Cache-Control": cacheControl },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return Response.json({ error: message }, { status: 404 });
  }
}