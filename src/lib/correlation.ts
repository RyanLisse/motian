import { randomUUID } from "crypto";

/** Generate a new correlation ID for tracing across steps */
export function generateCorrelationId(): string {
  return `corr_${randomUUID().replace(/-/g, "")}`;
}
