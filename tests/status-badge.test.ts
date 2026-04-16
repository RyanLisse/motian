import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("adds a dark-mode contrast override for the inactive badge", () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: "inactief" }));

    expect(html).toContain("Inactief");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("dark:text-foreground/70");
  });
});
