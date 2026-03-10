import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: unknown; href: string }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/droppable-vacancy", () => ({
  DroppableVacancy: ({ children }: { children: unknown }) =>
    createElement("div", { "data-droppable": "true" }, children),
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.doUnmock("react");
  vi.doUnmock("next/navigation");
  vi.doUnmock("@/hooks/use-mobile");
  vi.doUnmock("@/components/ui/sheet");
  vi.doUnmock("@/components/candidate-wizard/candidate-match-card");
  vi.doUnmock("@/components/ui/button");
});

describe("Detail surfaces recruiter workflow context", () => {
  it("job detail page preserves filters while surfacing recruiter cockpit and grading", () => {
    const source = readFile("app/opdrachten/[id]/page.tsx");

    expect(source).toContain("currentListParams.append(key, entry)");
    expect(source).toContain("const relatedLimit = 4");
    expect(source).toContain(
      "const related = [...companyRelated, ...genericRelated].slice(0, relatedLimit)",
    );
    expect(source).not.toContain(
      "const related = companyRelated.length > 0 ? companyRelated : genericRelated;",
    );
    expect(source).toContain('id="koppel-kandidaten"');
    expect(source).toContain('href="#koppel-kandidaten"');
    expect(source).toContain('id="recruiter-cockpit"');
    expect(source).toContain('id="ai-grading"');
    expect(source).toContain("Recruiter cockpit");
    expect(source).toContain("Volgende actie");
    expect(source).toContain("Gekoppelde kandidaten");
    expect(source).toContain("Bekijk AI aanbevelingen");
    expect(source).toContain("AI Grading");
    expect(source).toContain("source: applications.source");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting source contains a template literal
    expect(source).toContain("/professionals/${row.candidateId}");
  });

  it("OpdrachtenDetailSheet returns to the filtered list when the mobile sheet closes", async () => {
    const mockPush = vi.fn();
    let capturedOnOpenChange: ((open: boolean) => void) | undefined;

    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: mockPush }),
    }));

    vi.doMock("@/hooks/use-mobile", () => ({
      useIsMobile: () => true,
    }));

    vi.doMock("@/components/ui/sheet", () => ({
      Sheet: ({
        children,
        onOpenChange,
      }: {
        children: unknown;
        onOpenChange?: (open: boolean) => void;
      }) => {
        capturedOnOpenChange = onOpenChange;
        return createElement("div", { "data-sheet": "true" }, children);
      },
      SheetContent: ({ children }: { children: unknown }) =>
        createElement("div", { "data-sheet-content": "true" }, children),
      SheetDescription: ({ children }: { children: unknown }) => createElement("p", null, children),
      SheetHeader: ({ children }: { children: unknown }) => createElement("header", null, children),
      SheetTitle: ({ children }: { children: unknown }) => createElement("h1", null, children),
    }));

    const { OpdrachtenDetailSheet } = await import("../components/opdrachten-detail-sheet");

    const html = renderToStaticMarkup(
      createElement(
        OpdrachtenDetailSheet,
        {
          title: "Manager Inhuur",
          description: "Recruiter cockpit",
          listHref: "/opdrachten?regio=randstad&regio=noord",
        },
        createElement("div", null, "Paneelinhoud"),
      ),
    );

    expect(html).toContain("Paneelinhoud");
    expect(capturedOnOpenChange).toBeTypeOf("function");

    capturedOnOpenChange?.(true);
    expect(mockPush).not.toHaveBeenCalled();

    capturedOnOpenChange?.(false);
    expect(mockPush).toHaveBeenCalledWith("/opdrachten?regio=randstad&regio=noord");
  });

  it("inline candidate linking renders actionable content and posts selected matches", async () => {
    const mockRefresh = vi.fn();
    const buttonClicks: Array<(() => void) | undefined> = [];
    const matches = [
      {
        candidateId: "cand-1",
        candidateName: "Alice Example",
        quickScore: 88,
        matchId: "match-1",
        reasoning: "Sterke match",
        isLinked: false,
      },
      {
        candidateId: "cand-2",
        candidateName: "Bob Example",
        quickScore: 73,
        matchId: "match-2",
        reasoning: "Al bekend",
        isLinked: true,
      },
    ];

    const stateValues = [matches, new Set(["match-1"]), false, false, ""];
    let stateIndex = 0;

    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");

      return {
        ...actual,
        useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
        useEffect: (effect: () => void) => {
          effect();
        },
        useState: (initial: unknown) => {
          const index = stateIndex++;
          return [stateValues[index] ?? initial, vi.fn()] as const;
        },
      };
    });

    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ refresh: mockRefresh }),
    }));

    vi.doMock("@/components/candidate-wizard/candidate-match-card", () => ({
      CandidateMatchCard: ({
        match,
        selected,
      }: {
        match: (typeof matches)[number];
        selected: boolean;
      }) => createElement("div", { "data-selected": String(selected) }, match.candidateName),
    }));

    vi.doMock("@/components/ui/button", () => ({
      Button: ({
        children,
        onClick,
        asChild,
        ...props
      }: {
        children: unknown;
        onClick?: () => void;
        asChild?: boolean;
      }) => {
        if (asChild) return children;
        buttonClicks.push(onClick);
        return createElement("button", { ...props, type: "button" }, children);
      },
    }));

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/match-kandidaten")) {
        expect(init).toEqual({ method: "POST" });
        return {
          ok: true,
          json: async () => ({ matches, alreadyLinked: ["cand-2"] }),
        };
      }

      if (url.endsWith("/koppel")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { LinkCandidatesDialog } = await import("../components/link-candidates-dialog");

    const html = renderToStaticMarkup(
      createElement(LinkCandidatesDialog, {
        jobId: "job-1",
        jobTitle: "Manager Inhuur",
      }),
    );

    expect(html).toContain("Alice Example");
    expect(html).toContain("Bob Example");
    expect(html).toContain("Koppel aan screening");
    expect(html).toContain("Selecteer direct wie je aan screening wilt toevoegen.");
    expect(html).not.toContain("Recruiter cockpit");
    expect(html).not.toContain("AI Grading");
    expect(fetchMock).toHaveBeenCalledWith("/api/opdrachten/job-1/match-kandidaten", {
      method: "POST",
    });

    buttonClicks.at(-1)?.();
    await flushPromises();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/opdrachten/job-1/koppel",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds: ["match-1"] }),
      }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("JobListItem uses explicit workflow state and calendar-day deadline buckets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T00:30:00"));

    const { JobListItem } = await import("../components/job-list-item");

    const html = renderToStaticMarkup(
      createElement(JobListItem, {
        job: {
          id: "job-1",
          title: "Manager Inhuur",
          company: "Gemeente Utrecht",
          location: "Utrecht",
          platform: "opdrachtoverheid",
          workArrangement: "hybride",
          contractType: "interim",
          applicationDeadline: "2026-03-08T23:30:00",
        },
        isActive: false,
        variant: "card",
        pipelineCount: 0,
        hasPipeline: true,
        href: "/opdrachten/job-1",
      }),
    );

    expect(html).toContain("Sluit vandaag");
    expect(html).toContain("Workflow gekoppeld");
    expect(html).toContain("Open workflow");
    expect(html).not.toContain("Nog te koppelen");
  });

  it("candidate detail page keeps the recruiter section in Dutch and anchors match detail surfaces", () => {
    const source = readFile("app/professionals/[id]/page.tsx");

    expect(source).toContain("Recruiteroverzicht");
    expect(source).not.toContain("Recruiter context</h2>");
    expect(source).toContain('<section id="matches">');
    expect(source).toContain("ReportButton");
    expect(source).toContain("MatchDetail");
  });
});
