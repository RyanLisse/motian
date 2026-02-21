import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { db } from "../../src/db/index.js";
import { jobs } from "../../src/db/schema.js";
import { desc, eq, isNull, ilike, sql, and } from "drizzle-orm";

export function registerJobsCommand(program: Command) {
  const jobsCmd = program
    .command("jobs")
    .description("Opdrachten beheren en doorzoeken");

  // ── motian jobs list ──
  jobsCmd
    .command("list")
    .description("Lijst van opdrachten weergeven")
    .option("-p, --platform <platform>", "Filteren op platform")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (opts) => {
      const spinner = ora("Opdrachten ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);
        const conditions = [isNull(jobs.deletedAt)];
        if (opts.platform) {
          conditions.push(eq(jobs.platform, opts.platform));
        }

        const results = await db
          .select({
            titel: jobs.title,
            bedrijf: jobs.company,
            locatie: jobs.location,
            platform: jobs.platform,
            tarief: jobs.rateMax,
          })
          .from(jobs)
          .where(and(...conditions))
          .orderBy(desc(jobs.scrapedAt))
          .limit(limit);

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen opdrachten gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nOpdrachten (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          Titel: (r.titel ?? "").slice(0, 50),
          Bedrijf: r.bedrijf ?? "-",
          Locatie: (r.locatie ?? "-").slice(0, 25),
          Platform: r.platform,
          "Tarief (max)": r.tarief ? `€${r.tarief}` : "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen opdrachten");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian jobs show <id> ──
  jobsCmd
    .command("show <id>")
    .description("Volledige details van een opdracht weergeven")
    .action(async (id: string) => {
      const spinner = ora("Opdracht ophalen...").start();
      try {
        const [job] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, id))
          .limit(1);

        spinner.stop();

        if (!job) {
          console.log(chalk.yellow(`Opdracht ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(job.title));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Platform", job.platform],
          ["Extern ID", job.externalId],
          ["Bedrijf", job.company],
          ["Broker", job.contractLabel],
          ["Locatie", job.location],
          ["Provincie", job.province],
          ["Tarief", job.rateMin && job.rateMax ? `€${job.rateMin} - €${job.rateMax}` : job.rateMax ? `€${job.rateMax}` : "-"],
          ["Contract type", job.contractType],
          ["Werkregeling", job.workArrangement],
          ["Startdatum", job.startDate?.toLocaleDateString("nl-NL") ?? "-"],
          ["Einddatum", job.endDate?.toLocaleDateString("nl-NL") ?? "-"],
          ["Deadline", job.applicationDeadline?.toLocaleDateString("nl-NL") ?? "-"],
          ["Posities", job.positionsAvailable],
          ["URL", job.externalUrl],
          ["Gescraped op", job.scrapedAt?.toLocaleString("nl-NL") ?? "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        if (job.description) {
          console.log(chalk.bold("\nBeschrijving:"));
          console.log(job.description.slice(0, 1000));
          if (job.description.length > 1000) {
            console.log(chalk.gray(`\n... (${job.description.length} tekens totaal)`));
          }
        }

        const arrayFields: [string, unknown][] = [
          ["Eisen", job.requirements],
          ["Wensen", job.wishes],
          ["Competenties", job.competences],
          ["Voorwaarden", job.conditions],
        ];

        for (const [label, arr] of arrayFields) {
          if (Array.isArray(arr) && arr.length > 0) {
            console.log(chalk.bold(`\n${label}:`));
            for (const item of arr) {
              console.log(`  - ${typeof item === "string" ? item : JSON.stringify(item)}`);
            }
          }
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen opdracht");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian jobs search <query> ──
  jobsCmd
    .command("search <query>")
    .description("Zoeken op titel (ILIKE)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (query: string, opts) => {
      const spinner = ora(`Zoeken naar "${query}"...`).start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await db
          .select({
            id: jobs.id,
            titel: jobs.title,
            bedrijf: jobs.company,
            locatie: jobs.location,
            platform: jobs.platform,
          })
          .from(jobs)
          .where(and(isNull(jobs.deletedAt), ilike(jobs.title, `%${query}%`)))
          .orderBy(desc(jobs.scrapedAt))
          .limit(limit);

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow(`Geen opdrachten gevonden voor "${query}".`));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nZoekresultaten voor "${query}" (${results.length}):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Titel: (r.titel ?? "").slice(0, 50),
          Bedrijf: r.bedrijf ?? "-",
          Locatie: (r.locatie ?? "-").slice(0, 25),
          Platform: r.platform,
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij zoeken");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian jobs stats ──
  jobsCmd
    .command("stats")
    .description("Statistieken per platform, bedrijf en locatie")
    .action(async () => {
      const spinner = ora("Statistieken berekenen...").start();
      try {
        const [byPlatform, byCompany, byLocation, totalResult] =
          await Promise.all([
            db
              .select({
                platform: jobs.platform,
                aantal: sql<number>`count(*)::int`,
              })
              .from(jobs)
              .where(isNull(jobs.deletedAt))
              .groupBy(jobs.platform)
              .orderBy(desc(sql`count(*)`)),
            db
              .select({
                bedrijf: jobs.company,
                aantal: sql<number>`count(*)::int`,
              })
              .from(jobs)
              .where(isNull(jobs.deletedAt))
              .groupBy(jobs.company)
              .orderBy(desc(sql`count(*)`))
              .limit(10),
            db
              .select({
                locatie: jobs.location,
                aantal: sql<number>`count(*)::int`,
              })
              .from(jobs)
              .where(isNull(jobs.deletedAt))
              .groupBy(jobs.location)
              .orderBy(desc(sql`count(*)`))
              .limit(10),
            db
              .select({ total: sql<number>`count(*)::int` })
              .from(jobs)
              .where(isNull(jobs.deletedAt)),
          ]);

        spinner.stop();

        const total = totalResult[0]?.total ?? 0;
        console.log(chalk.bold.cyan(`\nMotian Opdracht Statistieken`));
        console.log(chalk.bold(`Totaal: ${total} opdrachten\n`));

        console.log(chalk.bold("Per platform:"));
        console.table(byPlatform);

        console.log(chalk.bold("Top 10 bedrijven:"));
        console.table(
          byCompany.map((r) => ({
            Bedrijf: r.bedrijf ?? "(onbekend)",
            Aantal: r.aantal,
          })),
        );

        console.log(chalk.bold("Top 10 locaties:"));
        console.table(
          byLocation.map((r) => ({
            Locatie: r.locatie ?? "(onbekend)",
            Aantal: r.aantal,
          })),
        );
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij berekenen statistieken");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
