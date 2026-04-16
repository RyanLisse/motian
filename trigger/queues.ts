import { queue } from "@trigger.dev/sdk";

export const EMBEDDING_PRODUCER_QUEUE_NAME = "embedding-producers";
export const EMBEDDING_PRODUCER_CONCURRENCY_LIMIT = 2;

export const embeddingProducerQueue = queue({
  name: EMBEDDING_PRODUCER_QUEUE_NAME,
  concurrencyLimit: EMBEDDING_PRODUCER_CONCURRENCY_LIMIT,
});
