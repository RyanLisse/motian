/**
 * Test helpers for `API_SECRET` bearer admission (internal app — no login session).
 */

export const TEST_API_SECRET = "test-api-secret-for-trust-boundary";

/** Builds an Authorization header value for Vitest suites. */
export function createTestBearerHeader(secret: string = TEST_API_SECRET): string {
  return `Bearer ${secret}`;
}

/** Headers object with a valid bearer for protected route/proxy tests. */
export function createTestAuthHeaders(
  secret: string = TEST_API_SECRET,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { Authorization: createTestBearerHeader(secret), ...extra };
}
