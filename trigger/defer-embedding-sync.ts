import { logger, metadata, task } from "@trigger.dev/sdk";
import { revalidatePath, revalidateTag } from "next/cache";
import { publish } from "@/src/lib/event-bus";
import {
  type DeferredEmbeddingSyncPayload,
  runDeferredEmbeddingSync,
} from "@/src/services/embedding";

function revalidateEntity(payload: DeferredEmbeddingSyncPayload) {
  switch (payload.entityType) {
    case "candidate":
      revalidateTag("candidates", "default");
      revalidatePath("/kandidaten");
      revalidatePath(`/kandidaten/${payload.entityId}`);
      revalidatePath("/overzicht");
      break;
    case "job":
      revalidateTag("jobs", "default");
      revalidatePath("/vacatures");
      revalidatePath(`/vacatures/${payload.entityId}`);
      revalidatePath("/overzicht");
      break;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const deferEmbeddingSyncTask = task({
  id: "defer-embedding-sync",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10_000,
    randomize: true,
  },
  maxDuration: 30,
  run: async (payload: DeferredEmbeddingSyncPayload, { ctx }) => {
    metadata
      .set("status", "started")
      .set("entityType", payload.entityType)
      .set("entityId", payload.entityId)
      .set("source", payload.source ?? null);

    publish("embedding:started", {
      ...payload,
      runId: ctx.run.id,
    });

    try {
      const result = await runDeferredEmbeddingSync(payload);
      revalidateEntity(payload);

      metadata
        .set("status", "completed")
        .set("embeddingStatus", result.embeddingStatus)
        .set("embedded", result.embedded)
        .set("indexed", result.indexed);

      publish("embedding:completed", {
        ...result,
        runId: ctx.run.id,
      });

      logger.info("Deferred embedding sync voltooid", {
        entityType: payload.entityType,
        entityId: payload.entityId,
        embeddingStatus: result.embeddingStatus,
        embedded: result.embedded,
        indexed: result.indexed,
        runId: ctx.run.id,
      });

      return result;
    } catch (error) {
      const message = toErrorMessage(error);
      metadata.set("status", "failed").set("error", message);

      publish("embedding:failed", {
        ...payload,
        error: message,
        runId: ctx.run.id,
      });

      logger.error("Deferred embedding sync mislukt", {
        entityType: payload.entityType,
        entityId: payload.entityId,
        error: message,
        runId: ctx.run.id,
      });

      throw error;
    }
  },
});
