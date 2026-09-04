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

/**
 * Upper bound for the query-embedding call inside the job search request path.
 *
 * `embed()` from the AI SDK performs its own retries and accepts no
 * `AbortSignal`, and `withRetry` above wraps it in three further attempts, so a
 * slow upstream compounds instead of failing fast. Measured against production
 * on 2026-09-04, the multi-word query "senior java developer" took 232s for
 * this reason, while single-word queries — which skip the vector branch — came
 * back in ~1.5s.
 */
export const QUERY_EMBEDDING_TIMEOUT_MS = 2500;

/**
 * Rejects if `run()` has not settled within `timeoutMs`.
 *
 * The in-flight request is not cancelled — the AI SDK exposes no handle for
 * that — but it stops holding the response open. Same constraint, and same
 * workaround, as the Trigger.dev `runs.list()` case in
 * docs/solutions/performance-issues/scraper-dashboard-cold-start-17s-to-1s-2026-04-16.md.
 *
 * Deliberately lives here rather than beside the search policy: several suites
 * replace `hybrid-search-policy` wholesale with `vi.doMock`, and a helper that
 * is `undefined` under mock would throw into the caller's catch and silently
 * drop the vector branch instead of timing it out.
 */
export function withTimeout<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  label = "Operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs}ms budget`));
    }, timeoutMs);
  });

  return Promise.race([run(), budget]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}
