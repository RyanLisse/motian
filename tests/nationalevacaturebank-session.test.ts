import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockChromiumLaunch,
  mockBrowserClose,
  mockContextCookies,
  mockPageContent,
  mockPageGoto,
  mockPageGetByRole,
  mockPageUrl,
  mockPageWaitForLoadState,
  mockPageWaitForURL,
  pageState,
} = vi.hoisted(() => {
  const pageState = {
    currentUrl: "https://myprivacy.dpgmedia.nl/consent",
    contents: [] as string[],
  };

  const locator = {
    first: vi.fn(() => locator),
    waitFor: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
  };

  const mockPageGoto = vi.fn(async () => undefined);
  const mockPageContent = vi.fn(async () => pageState.contents.shift() ?? "");
  const mockPageUrl = vi.fn(() => pageState.currentUrl);
  const mockPageGetByRole = vi.fn(() => locator);
  const mockPageWaitForURL = vi.fn(async () => {
    pageState.currentUrl = "https://www.nationalevacaturebank.nl/vacatures/branche/ict";
  });
  const mockPageWaitForLoadState = vi.fn(async () => undefined);
  const mockContextCookies = vi.fn(async () => [{ name: "dpgconsent", value: "ok" }]);
  const mockBrowserClose = vi.fn(async () => undefined);
  const mockChromiumLaunch = vi.fn(async () => ({
    newContext: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        goto: mockPageGoto,
        content: mockPageContent,
        url: mockPageUrl,
        getByRole: mockPageGetByRole,
        waitForURL: mockPageWaitForURL,
        waitForLoadState: mockPageWaitForLoadState,
      })),
      cookies: mockContextCookies,
    })),
    close: mockBrowserClose,
  }));

  return {
    mockChromiumLaunch,
    mockBrowserClose,
    mockContextCookies,
    mockPageContent,
    mockPageGoto,
    mockPageGetByRole,
    mockPageUrl,
    mockPageWaitForLoadState,
    mockPageWaitForURL,
    pageState,
  };
});

vi.mock("playwright", () => ({
  chromium: {
    launch: mockChromiumLaunch,
  },
}));

import { nationaleVacaturebankAdapter } from "../packages/scrapers/src/nationalevacaturebank";

const LISTING_HTML = `
  <html>
    <body>
      <main>
        <li>
          <a
            href="/vacature/123/senior-engineer"
            class="nvb_searchResult__card"
            data-analytics-label="vac-123"
          >
            <h2>Senior Engineer</h2>
            <strong class="nvb_companyName__card">Acme</strong>
            <span>Amsterdam</span>
            <div class="nvb_attributes__IP60d">
              <div class="nvb_attribute__row">32 - 40 uur</div>
              <div class="nvb_attribute__row">EUR 80 - 95</div>
              <div class="nvb_attribute__row">HBO</div>
            </div>
          </a>
        </li>
      </main>
    </body>
  </html>
`;

const DETAIL_HTML = `
  <html>
    <body>
      <div class="nvb_info__0vhLJ"><h2>Senior Engineer</h2></div>
      <div class="nvb_company__card">
        <a href="/bedrijf/acme">Acme</a>
        <a href="/locatie/amsterdam">Amsterdam</a>
      </div>
      <div>
        <h3 class="nvb_subHeading__section">Functieomschrijving</h3>
      </div>
      <div class="nvb_text__section">
        Bouw platformen voor recruitment teams.
      </div>
    </body>
  </html>
`;

describe("nationale vacaturebank session handling", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    pageState.currentUrl = "https://myprivacy.dpgmedia.nl/consent";
    pageState.contents = ["<html><body>DPG Media Privacy Gate</body></html>", LISTING_HTML];
    mockChromiumLaunch.mockClear();
    mockBrowserClose.mockClear();
    mockContextCookies.mockClear();
    mockPageContent.mockClear();
    mockPageGoto.mockClear();
    mockPageGetByRole.mockClear();
    mockPageUrl.mockClear();
    mockPageWaitForLoadState.mockClear();
    mockPageWaitForURL.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("keeps the default user agent when replaying cookie-backed requests", async () => {
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const cookieHeader = new Headers(init?.headers).get("Cookie");

      if (cookieHeader) {
        return new Response(LISTING_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("<html><body>DPG Media Privacy Gate</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    const result = await nationaleVacaturebankAdapter.validate({
      slug: "nationalevacaturebank",
      baseUrl: "https://www.nationalevacaturebank.nl",
      parameters: {
        sourcePath: "/vacatures/branche/ict",
      },
      auth: {},
    });

    expect(result.ok).toBe(true);
    const secondCall = vi.mocked(globalThis.fetch).mock.calls[1];
    const secondCallHeaders = new Headers(secondCall?.[1]?.headers);

    expect(secondCallHeaders.get("Cookie")).toBe("dpgconsent=ok");
    expect(secondCallHeaders.get("User-Agent")).toContain("MotianBot");
  });

  it("falls back to safe numeric defaults when NVB config values are malformed", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/vacatures/branche/ict")) {
        return new Response(LISTING_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.includes("/vacature/123/senior-engineer")) {
        return new Response(DETAIL_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await nationaleVacaturebankAdapter.scrape({
      slug: "nationalevacaturebank",
      baseUrl: "https://www.nationalevacaturebank.nl",
      parameters: {
        sourcePath: "/vacatures/branche/ict",
        maxPages: "geen-getal",
        detailLimit: "ook-geen-getal",
        detailConcurrency: "nog-steeds-geen-getal",
      },
      auth: {},
    });

    expect(result.errors).toEqual([]);
    expect(result.listings).toHaveLength(1);
  });
});
