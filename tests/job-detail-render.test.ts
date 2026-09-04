import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeadlineBadge } from "@/app/vacatures/[id]/_components/date-display";
import type { JobData } from "@/app/vacatures/[id]/_components/job-field-types";
import { JobDetailFields } from "@/app/vacatures/[id]/job-detail-fields";

function fixtureJob(overrides: Partial<JobData> = {}): JobData {
  return {
    company: "Gemeente Utrecht",
    rateMin: 80,
    rateMax: 110,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-10-01T00:00:00.000Z"),
    hoursPerWeek: 36,
    minHoursPerWeek: 32,
    durationMonths: 6,
    location: "Utrecht",
    workArrangement: "hybride",
    educationLevel: "hbo",
    workExperienceYears: 5,
    extensionPossible: true,
    applicationDeadline: new Date("2026-03-15T00:00:00.000Z"),
    contractLabel: "Interim",
    positionsAvailable: 1,
    externalId: "EXT-42",
    clientReferenceCode: "REF-42",
    allowsSubcontracting: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("job detail field rendering (R17)", () => {
  it("renders company, location, contract, and deadline for a fixture job", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    const html = renderToStaticMarkup(
      createElement(JobDetailFields, {
        job: fixtureJob(),
        variant: "desktop",
      }),
    );

    expect(html).toContain("Gemeente Utrecht");
    expect(html).toContain("Opdrachtgever");
    expect(html).toContain("Utrecht");
    expect(html).toContain("Locatie");
    expect(html).toContain("Interim");
    expect(html).toContain("Contract");
    expect(html).toContain("Deadline");
    expect(html).toContain("Hybride");
    // Future deadline → no expired badge
    expect(html).not.toContain("Verlopen");
  });

  it("fails the observable contract when company is dropped from the fixture", () => {
    const html = renderToStaticMarkup(
      createElement(JobDetailFields, {
        job: fixtureJob({ company: null }),
        variant: "desktop",
      }),
    );

    expect(html).not.toContain("Opdrachtgever");
    expect(html).toContain("Locatie");
    expect(html).toContain("Contract");
  });

  it("shows Verlopen badge for a past deadline and hides it for a future one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));

    const expired = renderToStaticMarkup(
      createElement(DeadlineBadge, { deadline: new Date("2026-03-01T00:00:00.000Z") }),
    );
    const open = renderToStaticMarkup(
      createElement(DeadlineBadge, { deadline: new Date("2026-03-20T00:00:00.000Z") }),
    );

    expect(expired).toContain("Verlopen");
    expect(open).toBe("");
  });

  it("omits the deadline section when applicationDeadline is null", () => {
    const html = renderToStaticMarkup(
      createElement(JobDetailFields, {
        job: fixtureJob({ applicationDeadline: null }),
        variant: "mobile",
      }),
    );

    expect(html).not.toContain("Deadline");
    expect(html).toContain("Gemeente Utrecht");
    expect(html).toContain("Interim");
  });
});
