import { describe, expect, it } from "vitest";
import { formatDateTime } from "../src/lib/helpers";

describe("formatDateTime", () => {
  it("formats dashboard timestamps in Europe/Amsterdam instead of server-local UTC", () => {
    const formatted = formatDateTime(new Date("2026-05-07T08:02:58.815Z"), "full");

    expect(formatted).toBe("7 mei 2026, 10:02");
  });
});
