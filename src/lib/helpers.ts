// Gedeelde utilities voor het recruitment platform

/**
 * Exponential backoff met jitter — voorkomt thundering herd bij rate limits
 */
export function calculateBackoff(attempt: number): number {
  const base = 1200 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

/**
 * Sleep helper voor retry loops
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
