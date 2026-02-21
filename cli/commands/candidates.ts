import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  listCandidates,
  getCandidateById,
  searchCandidates,
  createCandidate,
  getCandidateStats,
} from "../../src/services/candidates.js";

export function registerCandidatesCommand(program: Command) {
  const candidatesCmd = program
    .command("candidates")
    .description("Kandidaten beheren en doorzoeken");

  // ── motian candidates list ──
  candidatesCmd
    .command("list")
    .description("Lijst van kandidaten weergeven")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .option("-s, --source <source>", "Filteren op bron")
    .action(async (opts) => {
      const spinner = ora("Kandidaten ophalen...").start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);
        let results = await listCandidates(limit);

        if (opts.source) {
          results = results.filter(
            (c) => c.source?.toLowerCase() === opts.source.toLowerCase(),
          );
        }

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen kandidaten gevonden."));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nKandidaten (${results.length} resultaten):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Naam: (r.name ?? "").slice(0, 30),
          Rol: (r.role ?? "-").slice(0, 30),
          Locatie: (r.location ?? "-").slice(0, 25),
          Bron: r.source ?? "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen kandidaten");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian candidates show <id> ──
  candidatesCmd
    .command("show <id>")
    .description("Volledige details van een kandidaat weergeven")
    .action(async (id: string) => {
      const spinner = ora("Kandidaat ophalen...").start();
      try {
        const candidate = await getCandidateById(id);

        spinner.stop();

        if (!candidate) {
          console.log(chalk.yellow(`Kandidaat ${id} niet gevonden.`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n${"=".repeat(60)}`));
        console.log(chalk.bold.cyan(candidate.name));
        console.log(chalk.bold(`${"=".repeat(60)}\n`));

        const fields: [string, unknown][] = [
          ["Email", candidate.email],
          ["Telefoon", candidate.phone],
          ["Rol", candidate.role],
          ["Ervaring", candidate.experience],
          ["Locatie", candidate.location],
          ["Provincie", candidate.province],
          ["Bron", candidate.source],
          ["CV URL", candidate.resumeUrl],
          ["GDPR consent", candidate.gdprConsent ? "Ja" : "Nee"],
          ["Aangemaakt op", candidate.createdAt?.toLocaleString("nl-NL") ?? "-"],
          ["Bijgewerkt op", candidate.updatedAt?.toLocaleString("nl-NL") ?? "-"],
        ];

        for (const [label, value] of fields) {
          console.log(`${chalk.gray(label.padEnd(18))} ${value ?? "-"}`);
        }

        if (Array.isArray(candidate.skills) && (candidate.skills as string[]).length > 0) {
          console.log(chalk.bold("\nVaardigheden:"));
          for (const skill of candidate.skills as string[]) {
            console.log(`  - ${skill}`);
          }
        }

        if (Array.isArray(candidate.tags) && (candidate.tags as string[]).length > 0) {
          console.log(chalk.bold("\nTags:"));
          for (const tag of candidate.tags as string[]) {
            console.log(`  - ${tag}`);
          }
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen kandidaat");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian candidates search <query> ──
  candidatesCmd
    .command("search <query>")
    .description("Zoeken op naam (ILIKE)")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "20")
    .action(async (query: string, opts) => {
      const spinner = ora(`Zoeken naar "${query}"...`).start();
      try {
        const limit = Math.min(Number.parseInt(opts.limit, 10) || 20, 100);

        const results = await searchCandidates({ query, limit });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow(`Geen kandidaten gevonden voor "${query}".`));
          process.exit(0);
        }

        console.log(
          chalk.bold(`\nZoekresultaten voor "${query}" (${results.length}):\n`),
        );

        const rows = results.map((r) => ({
          ID: r.id.slice(0, 8),
          Naam: (r.name ?? "").slice(0, 30),
          Rol: (r.role ?? "-").slice(0, 30),
          Locatie: (r.location ?? "-").slice(0, 25),
          Bron: r.source ?? "-",
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij zoeken");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian candidates add ──
  candidatesCmd
    .command("add")
    .description("Nieuwe kandidaat toevoegen")
    .requiredOption("-n, --name <naam>", "Naam van de kandidaat")
    .option("-e, --email <email>", "E-mailadres")
    .option("-r, --role <rol>", "Functierol")
    .option("-k, --skills <vaardigheden>", "Vaardigheden (komma-gescheiden)")
    .option("-l, --location <locatie>", "Locatie")
    .option("-s, --source <bron>", "Bron (linkedin, indeed, cv_upload, manual)", "manual")
    .action(async (opts) => {
      const spinner = ora("Kandidaat aanmaken...").start();
      try {
        const skills = opts.skills
          ? opts.skills.split(",").map((s: string) => s.trim())
          : [];

        const candidate = await createCandidate({
          name: opts.name,
          email: opts.email,
          role: opts.role,
          skills,
          location: opts.location,
          source: opts.source,
        });

        spinner.succeed(chalk.green(`Kandidaat aangemaakt: ${candidate.id}`));

        console.log(`${chalk.gray("Naam".padEnd(18))} ${candidate.name}`);
        if (candidate.email) {
          console.log(`${chalk.gray("Email".padEnd(18))} ${candidate.email}`);
        }
        if (candidate.role) {
          console.log(`${chalk.gray("Rol".padEnd(18))} ${candidate.role}`);
        }

        console.log();
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij aanmaken kandidaat");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian candidates stats ──
  candidatesCmd
    .command("stats")
    .description("Statistieken per bron")
    .action(async () => {
      const spinner = ora("Statistieken berekenen...").start();
      try {
        const { total, bySource } = await getCandidateStats();

        spinner.stop();

        console.log(chalk.bold.cyan(`\nMotian Kandidaat Statistieken`));
        console.log(chalk.bold(`Totaal: ${total} kandidaten\n`));

        console.log(chalk.bold("Per bron:"));
        console.table(
          bySource.map((r) => ({
            Bron: r.source ?? "(onbekend)",
            Aantal: r.count,
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
