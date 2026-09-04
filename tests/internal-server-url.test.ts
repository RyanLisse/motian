import { describe, expect, it } from "vitest";
import {
  hasExplicitInternalServerUrl,
  resolveInternalServerUrl,
} from "@/src/lib/internal-server-url";

describe("resolveInternalServerUrl", () => {
  it.each([
    {
      name: "prefers INTERNAL_SERVER_URL",
      env: {
        INTERNAL_SERVER_URL: "http://internal:3001/",
        PUBLIC_API_BASE_URL: "https://api.example.com/",
        NEXT_URL: "https://app.example.com/",
      },
      expected: "http://internal:3001",
    },
    {
      name: "falls back to PUBLIC_API_BASE_URL",
      env: {
        PUBLIC_API_BASE_URL: "https://api.example.com/",
        NEXT_URL: "https://app.example.com/",
      },
      expected: "https://api.example.com",
    },
    {
      name: "falls back to NEXT_URL",
      env: {
        NEXT_URL: "https://app.example.com/",
      },
      expected: "https://app.example.com",
    },
    {
      name: "uses default loopback when nothing is configured",
      env: {},
      expected: "http://127.0.0.1:3001",
    },
    {
      name: "skips blank values",
      env: {
        INTERNAL_SERVER_URL: "   ",
        PUBLIC_API_BASE_URL: "",
        NEXT_URL: "https://app.example.com/",
      },
      expected: "https://app.example.com",
    },
    {
      name: "skips malformed values",
      env: {
        INTERNAL_SERVER_URL: "not-a-url",
        PUBLIC_API_BASE_URL: "://missing-scheme",
        NEXT_URL: "https://app.example.com/",
      },
      expected: "https://app.example.com",
    },
    {
      name: "trims trailing slashes",
      env: {
        INTERNAL_SERVER_URL: "http://127.0.0.1:3001///",
      },
      expected: "http://127.0.0.1:3001",
    },
  ])("$name", ({ env, expected }) => {
    expect(resolveInternalServerUrl(env)).toBe(expected);
  });
});

describe("hasExplicitInternalServerUrl", () => {
  it.each([
    {
      name: "true when INTERNAL_SERVER_URL is usable",
      env: { INTERNAL_SERVER_URL: "http://127.0.0.1:3001" },
      expected: true,
    },
    {
      name: "true when PUBLIC_API_BASE_URL is usable",
      env: { PUBLIC_API_BASE_URL: "https://api.example.com" },
      expected: true,
    },
    {
      name: "true when NEXT_URL is usable",
      env: { NEXT_URL: "https://app.example.com" },
      expected: true,
    },
    {
      name: "false when no URL vars are set",
      env: {},
      expected: false,
    },
    {
      name: "false when values are blank or malformed",
      env: {
        INTERNAL_SERVER_URL: " ",
        PUBLIC_API_BASE_URL: "bad-url",
        NEXT_URL: "",
      },
      expected: false,
    },
  ])("$name", ({ env, expected }) => {
    expect(hasExplicitInternalServerUrl(env)).toBe(expected);
  });
});
