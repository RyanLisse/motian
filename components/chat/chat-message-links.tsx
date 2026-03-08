import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INTERNAL_JOB_TAG = "motian-job-link";
const DEFAULT_ORIGIN = "http://localhost";
const MOTIAN_HOSTS = ["motian.ai", "motian.nl", "motian.vercel.app"];

const JOB_MARKDOWN_LINK_RE = /\[([^\]\n]+?)\]\(([^)\s]+)\)/g;
const JOB_HTML_LINK_RE = /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
const JOB_PATH_RE =
  /^\/opdracht(?:en)?\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[?#/].*)?$/i;

export const CHAT_MESSAGE_ALLOWED_TAGS = {
  [INTERNAL_JOB_TAG]: ["href"],
};

type StreamdownCustomTagProps = {
  href?: string;
  children?: ReactNode;
  className?: string;
  node?: unknown;
};

function ChatInternalJobLink({ href, children, className }: StreamdownCustomTagProps) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ size: "xs", variant: "outline" }),
        "mx-0.5 align-middle no-underline",
        className,
      )}
      data-chat-internal-job-link="true"
      data-streamdown="internal-job-link"
    >
      {children ?? "Bekijk vacature"}
    </Link>
  );
}

export const CHAT_MESSAGE_COMPONENTS = {
  [INTERNAL_JOB_TAG]: ChatInternalJobLink,
};

export function normalizeChatJobHref(
  rawHref: string,
  currentOrigin?: string | null,
): string | null {
  const trimmedHref = rawHref.trim();
  const relativePath = matchJobPath(trimmedHref);

  if (relativePath) {
    return relativePath;
  }

  try {
    const parsed = new URL(trimmedHref, currentOrigin ?? DEFAULT_ORIGIN);

    if (!isRecognizedMotianOrigin(parsed, currentOrigin)) {
      return null;
    }

    return matchJobPath(parsed.pathname);
  } catch {
    return null;
  }
}

export function rewriteChatJobLinks(markdown: string, currentOrigin?: string | null): string {
  return rewriteOutsideLiteralCode(markdown, (segment) =>
    rewriteHtmlJobLinks(rewriteMarkdownJobLinks(segment, currentOrigin), currentOrigin),
  );
}

function rewriteOutsideLiteralCode(
  markdown: string,
  rewriteSegment: (segment: string) => string,
): string {
  const segments: string[] = [];
  let cursor = 0;

  while (cursor < markdown.length) {
    const fencedRange = findFencedCodeBlock(markdown, cursor);
    const codeSpanRange = findInlineCodeSpan(markdown, cursor);
    let nextProtectedRange = fencedRange ?? codeSpanRange;

    if (fencedRange && codeSpanRange) {
      nextProtectedRange = fencedRange.start <= codeSpanRange.start ? fencedRange : codeSpanRange;
    }

    if (nextProtectedRange) {
      if (nextProtectedRange.start > cursor) {
        segments.push(rewriteSegment(markdown.slice(cursor, nextProtectedRange.start)));
      }

      segments.push(markdown.slice(nextProtectedRange.start, nextProtectedRange.end));
      cursor = nextProtectedRange.end;
      continue;
    }

    segments.push(rewriteSegment(markdown.slice(cursor)));
    break;
  }

  return segments.join("");
}

function rewriteMarkdownJobLinks(markdown: string, currentOrigin?: string | null): string {
  return markdown.replace(JOB_MARKDOWN_LINK_RE, (match, label: string, href: string) => {
    const internalHref = normalizeChatJobHref(href, currentOrigin);

    if (!internalHref) {
      return match;
    }

    return `<${INTERNAL_JOB_TAG} href="${escapeHtmlAttribute(internalHref)}">${escapeHtml(label)}</${INTERNAL_JOB_TAG}>`;
  });
}

function rewriteHtmlJobLinks(markdown: string, currentOrigin?: string | null): string {
  return markdown.replace(
    JOB_HTML_LINK_RE,
    (
      match,
      _beforeHref: string,
      _quote: string,
      href: string,
      _afterHref: string,
      content: string,
    ) => {
      const internalHref = normalizeChatJobHref(href, currentOrigin);

      if (!internalHref) {
        return match;
      }

      return `<${INTERNAL_JOB_TAG} href="${escapeHtmlAttribute(internalHref)}">${content}</${INTERNAL_JOB_TAG}>`;
    },
  );
}

function findFencedCodeBlock(
  markdown: string,
  fromIndex: number,
): { start: number; end: number } | null {
  let lineStart = fromIndex;

  if (lineStart > 0 && markdown[lineStart - 1] !== "\n") {
    const nextLineBreak = markdown.indexOf("\n", lineStart);

    if (nextLineBreak === -1) {
      return null;
    }

    lineStart = nextLineBreak + 1;
  }

  while (lineStart < markdown.length) {
    const lineEnd = markdown.indexOf("\n", lineStart);
    const nextLineStart = lineEnd === -1 ? markdown.length : lineEnd + 1;
    const line = markdown.slice(lineStart, lineEnd === -1 ? markdown.length : lineEnd);
    const openingFence = parseFenceLine(line);

    if (openingFence) {
      let searchStart = nextLineStart;

      while (searchStart <= markdown.length) {
        const searchLineEnd = markdown.indexOf("\n", searchStart);
        const searchNextLineStart = searchLineEnd === -1 ? markdown.length : searchLineEnd + 1;
        const searchLine = markdown.slice(
          searchStart,
          searchLineEnd === -1 ? markdown.length : searchLineEnd,
        );

        if (isClosingFenceLine(searchLine, openingFence.marker, openingFence.length)) {
          return { start: lineStart, end: searchNextLineStart };
        }

        if (searchLineEnd === -1) {
          return { start: lineStart, end: markdown.length };
        }

        searchStart = searchNextLineStart;
      }

      return { start: lineStart, end: markdown.length };
    }

    if (lineEnd === -1) {
      return null;
    }

    lineStart = nextLineStart;
  }

  return null;
}

function findInlineCodeSpan(
  markdown: string,
  fromIndex: number,
): { start: number; end: number } | null {
  let cursor = fromIndex;

  while (cursor < markdown.length) {
    if (markdown[cursor] !== "`") {
      cursor += 1;
      continue;
    }

    const fenceLength = countRepeatedCharacter(markdown, cursor, "`");
    const closingIndex = markdown.indexOf("`".repeat(fenceLength), cursor + fenceLength);

    if (closingIndex === -1) {
      cursor += fenceLength;
      continue;
    }

    return { start: cursor, end: closingIndex + fenceLength };
  }

  return null;
}

function parseFenceLine(line: string): { marker: "`" | "~"; length: number } | null {
  const indentationLength = getFenceIndentationLength(line);

  if (indentationLength === null) {
    return null;
  }

  const marker = line[indentationLength];

  if (marker !== "`" && marker !== "~") {
    return null;
  }

  const fenceLength = countRepeatedCharacter(line, indentationLength, marker);

  if (fenceLength < 3) {
    return null;
  }

  return { marker, length: fenceLength };
}

function isClosingFenceLine(line: string, marker: "`" | "~", minimumLength: number): boolean {
  const indentationLength = getFenceIndentationLength(line);

  if (indentationLength === null || line[indentationLength] !== marker) {
    return false;
  }

  const fenceLength = countRepeatedCharacter(line, indentationLength, marker);

  if (fenceLength < minimumLength) {
    return false;
  }

  return line.slice(indentationLength + fenceLength).trim().length === 0;
}

function getFenceIndentationLength(line: string): number | null {
  let index = 0;

  while (index < line.length && line[index] === " ") {
    index += 1;
  }

  return index <= 3 ? index : null;
}

function countRepeatedCharacter(input: string, startIndex: number, character: string): number {
  let index = startIndex;

  while (input[index] === character) {
    index += 1;
  }

  return index - startIndex;
}

function matchJobPath(pathname: string): string | null {
  const match = JOB_PATH_RE.exec(pathname);

  if (!match) {
    return null;
  }

  return `/opdrachten/${match[1]}`;
}

function isRecognizedMotianOrigin(parsedUrl: URL, currentOrigin?: string | null): boolean {
  if (currentOrigin && parsedUrl.origin === currentOrigin) {
    return true;
  }

  return MOTIAN_HOSTS.some(
    (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`),
  );
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
