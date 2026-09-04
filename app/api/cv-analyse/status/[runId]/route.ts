import { runs } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { requirePrincipal } from "@/src/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const principalOrResponse = await requirePrincipal(_request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  const { runId } = await context.params;

  try {
    const run = await runs.retrieve(runId);

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
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return Response.json({ error: message }, { status: 404 });
  }
}
