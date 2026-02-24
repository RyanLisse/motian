import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Motian Docs</h1>
      <p className="max-w-lg text-fd-muted-foreground">
        Documentatie voor het AI-Recruitment Platform — matching, scraping,
        CV-analyse, MCP-server en CLI.
      </p>
      <div className="flex gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground hover:bg-fd-primary/90"
        >
          Aan de slag
        </Link>
        <Link
          href="/docs/architectuur"
          className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-4 py-2 text-sm font-medium hover:bg-fd-accent"
        >
          Architectuur
        </Link>
      </div>
    </main>
  );
}
