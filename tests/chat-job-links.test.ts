import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CHAT_MESSAGE_ALLOWED_TAGS,
  CHAT_MESSAGE_COMPONENTS,
  normalizeChatJobHref,
  rewriteChatJobLinks,
} from "@/components/chat/chat-message-links";
import { MessageResponse } from "@/src/components/ai-elements/message";

const JOB_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("chat job links", () => {
  it("normalizes only relative or same-origin Motian job URLs", () => {
    expect(normalizeChatJobHref(`/opdrachten/${JOB_ID}`)).toBe(`/opdrachten/${JOB_ID}`);
    expect(normalizeChatJobHref(`/opdracht/${JOB_ID}`)).toBe(`/opdrachten/${JOB_ID}`);
    expect(
      normalizeChatJobHref(
        `https://motian.local/opdrachten/${JOB_ID}?utm=ignored`,
        "https://motian.local",
      ),
    ).toBe(`/opdrachten/${JOB_ID}`);
    expect(normalizeChatJobHref(`https://motian.ai/opdracht/${JOB_ID}`)).toBe(
      `/opdrachten/${JOB_ID}`,
    );
    expect(normalizeChatJobHref(`https://motian.nl/opdracht/${JOB_ID}`)).toBe(
      `/opdrachten/${JOB_ID}`,
    );
    expect(normalizeChatJobHref(`https://motian.vercel.app/opdracht/${JOB_ID}`)).toBe(
      `/opdrachten/${JOB_ID}`,
    );
    expect(
      normalizeChatJobHref(`https://external.example/opdrachten/${JOB_ID}`, "https://motian.local"),
    ).toBeNull();
  });

  it("rewrites internal job markdown links without touching external links", () => {
    const rewritten = rewriteChatJobLinks(
      [
        `Open [Bekijk vacature](/opdrachten/${JOB_ID}).`,
        "Gebruik ook [de bron](https://external.example/job) als referentie.",
      ].join("\n\n"),
    );

    expect(rewritten).toContain(
      `<motian-job-link href="/opdrachten/${JOB_ID}">Bekijk vacature</motian-job-link>`,
    );
    expect(rewritten).toContain("[de bron](https://external.example/job)");
  });

  it("rewrites internal job html anchors without touching external html anchors", () => {
    const rewritten = rewriteChatJobLinks(
      [
        `<a href="https://motian.nl/opdracht/${JOB_ID}">Bekijk opdracht</a>`,
        `<a href="https://external.example/job">Externe bron</a>`,
      ].join("\n\n"),
      "https://motian.local",
    );

    expect(rewritten).toContain(
      `<motian-job-link href="/opdrachten/${JOB_ID}">Bekijk opdracht</motian-job-link>`,
    );
    expect(rewritten).toContain(`<a href="https://external.example/job">Externe bron</a>`);
  });

  it("preserves inline code spans and fenced code blocks while still rewriting real links", () => {
    const rewritten = rewriteChatJobLinks(
      [
        `Open [Bekijk vacature](/opdrachten/${JOB_ID}).`,
        "",
        `Inline code: \`[Bekijk vacature](/opdrachten/${JOB_ID})\` en \`<a href="https://motian.nl/opdracht/${JOB_ID}">Bekijk opdracht</a>\``,
        "",
        "```md",
        `[Bekijk vacature](/opdrachten/${JOB_ID})`,
        `<a href="https://motian.nl/opdracht/${JOB_ID}">Bekijk opdracht</a>`,
        "```",
      ].join("\n"),
      "https://motian.local",
    );

    expect(rewritten.match(/<motian-job-link\b/g) ?? []).toHaveLength(1);
    expect(rewritten).toContain(`\`[Bekijk vacature](/opdrachten/${JOB_ID})\``);
    expect(rewritten).toContain(
      `\`<a href="https://motian.nl/opdracht/${JOB_ID}">Bekijk opdracht</a>\``,
    );
    expect(rewritten).toContain("```md");
    expect(rewritten).toContain(`[Bekijk vacature](/opdrachten/${JOB_ID})`);
    expect(rewritten).toContain(
      `<a href="https://motian.nl/opdracht/${JOB_ID}">Bekijk opdracht</a>`,
    );
  });

  it("renders internal job links as direct app anchors while external links stay on the safety path", () => {
    const html = renderToStaticMarkup(
      createElement(
        MessageResponse,
        {
          allowedTags: CHAT_MESSAGE_ALLOWED_TAGS,
          components: CHAT_MESSAGE_COMPONENTS,
        },
        rewriteChatJobLinks(
          `Bekijk [de vacature](/opdrachten/${JOB_ID}) of [de externe bron](https://external.example/job).`,
        ),
      ),
    );

    expect(html).toContain(`href="/opdrachten/${JOB_ID}"`);
    expect(html).toContain('data-chat-internal-job-link="true"');
    expect(html).toContain('data-streamdown="internal-job-link"');
    expect(html).toContain('data-streamdown="link"');
  });
});
