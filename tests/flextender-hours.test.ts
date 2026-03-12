import { describe, expect, it } from "vitest";
import { parseHoursPerWeek } from "../packages/scrapers/src/flextender";

describe("Flextender hours parsing", () => {
  it("keeps valid single and ranged weekly hours", () => {
    expect(parseHoursPerWeek("36 uur")).toEqual({ hoursPerWeek: 36 });
    expect(parseHoursPerWeek("24 tot 32 uur")).toEqual({
      minHoursPerWeek: 24,
      hoursPerWeek: 32,
    });
  });

  it("drops impossible weekly hour values instead of failing downstream validation", () => {
    expect(parseHoursPerWeek("220 uur")).toEqual({});
    expect(parseHoursPerWeek("24 tot 220 uur")).toEqual({});
    expect(parseHoursPerWeek("0 tot 36 uur")).toEqual({});
  });
});
