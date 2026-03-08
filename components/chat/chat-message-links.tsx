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
  return rewriteHtmlJobLinks(rewriteMarkdownJobLinks(markdown, currentOrigin), currentOrigin);
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
