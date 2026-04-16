import { describe, expect, it } from "vitest";
import {
  computeMedian,
  evaluateRouteBudgets,
  LIGHTHOUSE_ROUTE_BUDGETS,
} from "../scripts/assert-lighthouse-routes";

describe("lighthouse route budgets", () => {
  it("computes the median from odd-length samples", () => {
    expect(computeMedian([5, 1, 9])).toBe(5);
  });

  it("computes the median from even-length samples", () => {
    expect(computeMedian([0.8, 0.7])).toBe(0.75);
  });

  it("evaluates route-specific failures and warnings from collected runs", () => {
    const summary = evaluateRouteBudgets({
      "/overzicht": [
        { score: 0.82, lcp: 2100, tbt: 700, fcp: 1100, cls: 0 },
        { score: 0.81, lcp: 2200, tbt: 780, fcp: 1200, cls: 0 },
        { score: 0.84, lcp: 2000, tbt: 760, fcp: 1150, cls: 0 },
      ],
      "/kandidaten": [
        { score: 0.8, lcp: 3600, tbt: 550, fcp: 1000, cls: 0 },
        { score: 0.79, lcp: 3500, tbt: 570, fcp: 980, cls: 0 },
        { score: 0.78, lcp: 3550, tbt: 530, fcp: 1010, cls: 0 },
      ],
      "/vacatures": [
        { score: 0.58, lcp: 4700, tbt: 820, fcp: 1200, cls: 0 },
        { score: 0.59, lcp: 4650, tbt: 810, fcp: 1180, cls: 0 },
        { score: 0.57, lcp: 4800, tbt: 830, fcp: 1220, cls: 0 },
      ],
      "/chat": [
        { score: 0.74, lcp: 3600, tbt: 1300, fcp: 1400, cls: 0 },
        { score: 0.73, lcp: 3650, tbt: 1280, fcp: 1450, cls: 0 },
        { score: 0.75, lcp: 3550, tbt: 1290, fcp: 1380, cls: 0 },
      ],
    });

    const byRoute = Object.fromEntries(summary.routes.map((route) => [route.route, route]));

    expect(byRoute["/overzicht"]?.failures).toHaveLength(0);
    expect(byRoute["/overzicht"]?.warnings).toHaveLength(0);

    expect(byRoute["/kandidaten"]?.failures).toHaveLength(0);
    expect(byRoute["/kandidaten"]?.warnings).toHaveLength(0);

    expect(byRoute["/vacatures"]?.failures).toEqual([
      `Performance median 0.58 below ${LIGHTHOUSE_ROUTE_BUDGETS["/vacatures"].performanceMin.toFixed(2)}`,
      `LCP median 4700ms above ${LIGHTHOUSE_ROUTE_BUDGETS["/vacatures"].lcpMaxMs}ms`,
    ]);
    expect(byRoute["/vacatures"]?.warnings).toEqual([
      `TBT median 820ms above ${LIGHTHOUSE_ROUTE_BUDGETS["/vacatures"].tbtWarnMs}ms`,
    ]);

    expect(byRoute["/chat"]?.failures).toHaveLength(0);
    expect(byRoute["/chat"]?.warnings).toEqual([
      `TBT median 1290ms above ${LIGHTHOUSE_ROUTE_BUDGETS["/chat"].tbtWarnMs}ms`,
    ]);

    expect(summary.failureCount).toBe(2);
    expect(summary.warningCount).toBe(2);
  });
});
