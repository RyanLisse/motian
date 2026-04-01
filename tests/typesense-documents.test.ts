import { describe, expect, it } from "vitest";

import {
  toTypesenseCandidateDocument,
  toTypesenseJobDocument,
} from "../src/services/search-index/typesense-documents";

describe("typesense documents", () => {
  it("maps job rows into typesense-friendly documents", () => {
    const document = toTypesenseJobDocument({
      id: "job-1",
      platform: "opdrachtoverheid",
      externalId: "ext-1",
      externalUrl: "https://example.com/job-1",
      title: "Senior Java Developer",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      location: "Utrecht",
      province: "Utrecht",
      searchText: "Senior Java Developer Motian Utrecht",
      status: "open",
      categories: ["ICT", "Backend"],
      contractType: "interim",
      workArrangement: "hybride",
      rateMin: 90,
      rateMax: 110,
      hoursPerWeek: 36,
      minHoursPerWeek: 32,
      postedAt: new Date("2026-03-20T10:00:00.000Z"),
      applicationDeadline: new Date("2026-04-01T10:00:00.000Z"),
      scrapedAt: new Date("2026-03-28T09:00:00.000Z"),
      deletedAt: null,
    });

    expect(document).toEqual({
      id: "job-1",
      platform: "opdrachtoverheid",
      title: "Senior Java Developer",
      company: "Motian",
      endClient: "Gemeente Utrecht",
      province: "Utrecht",
      searchText: "Senior Java Developer Motian Utrecht",
      status: "open",
      categories: ["ICT", "Backend"],
      contractType: "interim",
      workArrangement: "hybride",
      rateMin: 90,
      rateMax: 110,
      hoursPerWeek: 36,
      minHoursPerWeek: 32,
      postedAtTs: new Date("2026-03-20T10:00:00.000Z").getTime(),
      applicationDeadlineTs: new Date("2026-04-01T10:00:00.000Z").getTime(),
      scrapedAtTs: new Date("2026-03-28T09:00:00.000Z").getTime(),
    });
  });

  it("omits nullable job fields and normalizes array defaults", () => {
    const document = toTypesenseJobDocument({
      id: "job-2",
      platform: "opdrachtoverheid",
      externalId: "ext-2",
      title: "Business Analyst",
      searchText: "Business Analyst",
      status: "open",
      categories: null,
      deletedAt: null,
      scrapedAt: null,
      postedAt: null,
      applicationDeadline: null,
    });

    expect(document).toEqual({
      id: "job-2",
      platform: "opdrachtoverheid",
      title: "Business Analyst",
      searchText: "Business Analyst",
      status: "open",
      categories: [],
      scrapedAtTs: 0,
    });
  });

  it("maps candidate rows into typesense-friendly documents", () => {
    const document = toTypesenseCandidateDocument({
      id: "candidate-1",
      name: "Jane Doe",
      role: "Recruiter",
      location: "Amsterdam",
      province: "Noord-Holland",
      skills: ["sourcing", "boolean search"],
      headline: "Senior recruiter publieke sector",
      profileSummary: "10 jaar ervaring in detachering en overheid.",
      source: "linkedin",
      hourlyRate: 95,
      availability: "direct",
      matchingStatus: "open",
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
      updatedAt: new Date("2026-03-27T09:00:00.000Z"),
      lastMatchedAt: new Date("2026-03-26T09:00:00.000Z"),
      matchingStatusUpdatedAt: new Date("2026-03-27T08:00:00.000Z"),
      deletedAt: null,
    });

    expect(document).toEqual({
      id: "candidate-1",
      name: "Jane Doe",
      role: "Recruiter",
      location: "Amsterdam",
      skills: ["sourcing", "boolean search"],
      searchText: "Jane Doe Recruiter Amsterdam sourcing boolean search",
      matchingStatus: "open",
      createdAtTs: new Date("2026-03-01T09:00:00.000Z").getTime(),
      updatedAtTs: new Date("2026-03-27T09:00:00.000Z").getTime(),
    });
  });

  it("normalizes missing candidate array fields to empty arrays", () => {
    const document = toTypesenseCandidateDocument({
      id: "candidate-2",
      name: "John Doe",
      matchingStatus: "open",
      skills: null,
      createdAt: null,
      updatedAt: null,
      lastMatchedAt: null,
      matchingStatusUpdatedAt: null,
      deletedAt: null,
    });

    expect(document).toEqual({
      id: "candidate-2",
      name: "John Doe",
      searchText: "John Doe",
      matchingStatus: "open",
      skills: [],
      createdAtTs: 0,
    });
  });
});
