import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { inferEvidenceContentType } from "@/src/autopilot/evidence/content-type";
import {
  buildBlobArtifactUrl,
  findEvidenceArtifact,
  loadRunSummaryFromReportUrl,
} from "@/src/autopilot/run-detail";
import { db, eq } from "@/src/db";
import { autopilotRuns } from "@/src/db/schema";
import { downloadFile } from "@/src/lib/file-storage";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ runId: string; journeyId: string; artifactId: string }>;
  },
) {
  const { runId, journeyId, artifactId } = await context.params;

  const [run] = await db
    .select()
    .from(autopilotRuns)
    .where(eq(autopilotRuns.runId, runId))
    .limit(1);

  if (!run?.reportUrl) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  try {
    const { summary } = await loadRunSummaryFromReportUrl(run.reportUrl);
    const artifact = findEvidenceArtifact(summary, journeyId, artifactId);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const blobUrl = buildBlobArtifactUrl(run.reportUrl, journeyId, artifact);
    const blobBuffer = await downloadFile(blobUrl);
    const buffer =
      artifact.metadata?.contentEncoding === "gzip" ? gunzipSync(blobBuffer) : blobBuffer;

    const headers = new Headers({
      "content-type": inferEvidenceContentType(artifact.kind),
      "cache-control": "private, max-age=60",
    });

    if (new URL(request.url).searchParams.get("download") === "1") {
      headers.set(
        "content-disposition",
        `attachment; filename="${artifact.path.split("/").pop() ?? artifact.id}"`,
      );
    }

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error(
      `[autopilot] Failed to stream artifact ${artifactId} for run ${runId}:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Artifact unavailable" }, { status: 500 });
  }
}
