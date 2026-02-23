/**
 * Generic retry helper with exponential backoff + jitter.
 * Retries on 429, 500, 503, and network errors (status 0).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 3,
    baseDelayMs = 1000,
    label = "Retry",
  }: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isLast = attempt === maxAttempts;
      const status =
        err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      const isRetryable = status === 429 || status === 500 || status === 503 || status === 0;

      if (isLast || !isRetryable) throw err;

      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 500;
      console.log(
        `[${label}] Retry ${attempt}/${maxAttempts} after ${Math.round(delay)}ms (status: ${status})`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}
