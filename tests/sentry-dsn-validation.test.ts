import { describe, expect, it } from "vitest";
import { getSafeSentryDsn, isValidSentryDsn } from "../src/lib/sentry-config";

describe("sentry DSN validation", () => {
  it("accepts standard Sentry SaaS DSNs", () => {
    const dsn = "https://examplePublicKey@o4507090437668864.ingest.sentry.io/4510936878481488";
    expect(isValidSentryDsn(dsn)).toBe(true);
    expect(getSafeSentryDsn(dsn)).toBe(dsn);
  });

  it("rejects malformed hosted DSNs that use unsupported ingest hostnames", () => {
    const dsn = "https://examplePublicKey@o4507090437668864.ingest.de.sentry.io/4510936878481488";
    expect(isValidSentryDsn(dsn)).toBe(false);
    expect(getSafeSentryDsn(dsn)).toBeUndefined();
  });

  it("rejects DSNs without a numeric project id", () => {
    expect(isValidSentryDsn("https://key@o0.ingest.sentry.io/not-a-project")).toBe(false);
  });
});
