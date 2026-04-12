import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { buildCommercialCvDraft } from "@/src/services/commercial-cv-generation";
import { renderCommercialCvHtml } from "@/src/services/commercial-cv-pdf";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1).optional(),
});

async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return req.json();
  }

  const formData = await req.formData();
  return {
    candidateId: formData.get("candidateId"),
    jobId: formData.get("jobId") || undefined,
  };
}

/**
 * POST /api/commercieel-cv/html — branded HTML version of the commercial CV.
 * Open in a new tab and use the browser's print dialog for PDF export.
 */
export const POST = withApiHandler(
  async (req: Request) => {
    const json = await parseRequestBody(req);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const draft = await buildCommercialCvDraft(parsed.data);
      const html = renderCommercialCvHtml(draft);

      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-cache, no-store",
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Onbekende fout";
      if (message.includes("niet gevonden")) {
        return Response.json({ error: message }, { status: 404 });
      }
      throw e;
    }
  },
  { logPrefix: "POST /api/commercieel-cv/html error" },
);
