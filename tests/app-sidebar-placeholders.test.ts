import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("app shell placeholder audit", () => {
  it("does not hardcode a fake sidebar user or subscription plan", () => {
    const source = readSource("components/app-sidebar.tsx");

    expect(source).not.toContain('name: "Ryan"');
    expect(source).not.toContain('email: "ryan@motian.nl"');
    expect(source).not.toContain('avatar: "/avatars/ryan.jpg"');
    expect(source).not.toContain('plan: "Pro"');
  });

  it("keeps settings wired to a real page and removes the logout placeholder", () => {
    const source = readSource("components/nav-user.tsx");

    expect(source).toContain('href="/settings"');
    expect(source).not.toContain("Uitloggen");
  });
});
