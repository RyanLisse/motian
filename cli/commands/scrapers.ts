import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getAllConfigs, getHealth, updateConfig } from "../../src/services/scrapers.js";
import { getHistory } from "../../src/services/scrape-results.js";

export function registerScraperCommand(program: Command) {
  const scraperCmd = program
    .command("scraper")
    .description("Scraper configuratie en gezondheid beheren");

  // ── motian scraper list ──
  scraperCmd
    .command("list")
    .description("Alle scraper configuraties weergeven")
    .action(async () => {
      const spinner = ora("Scraper configuraties ophalen...").start();
      try {
        const configs = await getAllConfigs();
        spinner.stop();

        if (configs.length === 0) {
          console.log(chalk.yellow("Geen scraper configuraties gevonden."));
          return;
        }

        console.log(chalk.bold(`\nScraper Configuraties (${configs.length}):\n`));

        const rows = configs.map((c) => ({
          Platform: c.platform,
          Actief: c.isActive ? chalk.green("Ja") : chalk.red("Nee"),
          "Cron Schema": c.cronExpression ?? "-",
          "Laatste run": c.lastRunAt?.toLocaleString("nl-NL") ?? "Nooit",
          Status: c.lastRunStatus ?? "-",
          "Fouten (reeks)": c.consecutiveFailures ?? 0,
          URL: (c.baseUrl ?? "").slice(0, 40),
        }));

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen configuraties");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian scraper status ──
  scraperCmd
    .command("status")
    .description("Gezondheidscontrole van alle scrapers")
    .action(async () => {
      const spinner = ora("Gezondheidsrapport genereren...").start();
      try {
        const report = await getHealth();
        spinner.stop();

        const statusColors: Record<string, (s: string) => string> = {
          gezond: chalk.green,
          waarschuwing: chalk.yellow,
          kritiek: chalk.red,
          inactief: chalk.gray,
        };

        const overallColor = statusColors[report.overall] ?? chalk.white;
        console.log(
          chalk.bold(`\nAlgehele status: ${overallColor(report.overall.toUpperCase())}\n`),
        );

        const rows = report.data.map((h) => {
          const colorFn = statusColors[h.status] ?? chalk.white;
          return {
            Platform: h.platform,
            Status: colorFn(h.status),
            Actief: h.isActive ? chalk.green("Ja") : chalk.red("Nee"),
            "Runs (24u)": h.runs24h,
            "Fouten (24u)": h.failures24h,
            "Foutpercentage": `${(h.failureRate * 100).toFixed(0)}%`,
            "Laatste run": h.lastRunAt?.toLocaleString("nl-NL") ?? "Nooit",
          };
        });

        console.table(rows);

        // Circuit breaker details
        const configs = await getAllConfigs();
        const breakers = configs.filter(
          (c) => (c.consecutiveFailures ?? 0) > 0,
        );
        if (breakers.length > 0) {
          console.log(chalk.bold.yellow("\nCircuit Breaker Waarschuwingen:"));
          for (const b of breakers) {
            console.log(
              `  ${chalk.yellow("!")} ${b.platform}: ${b.consecutiveFailures} opeenvolgende fouten`,
            );
          }
          console.log();
        }
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij gezondheidscontrole");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian scraper history ──
  scraperCmd
    .command("history")
    .description("Recente scrape resultaten weergeven")
    .option("-p, --platform <platform>", "Filteren op platform")
    .option("-l, --limit <aantal>", "Maximum aantal resultaten", "10")
    .action(async (opts) => {
      const spinner = ora("Scrape geschiedenis ophalen...").start();
      try {
        const limit = Number.parseInt(opts.limit, 10) || 10;
        const results = await getHistory({
          platform: opts.platform,
          limit,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow("Geen scrape resultaten gevonden."));
          process.exit(0);
        }

        console.log(chalk.bold(`\nScrape Geschiedenis (${results.length} resultaten):\n`));

        const statusColors: Record<string, (s: string) => string> = {
          success: chalk.green,
          partial: chalk.yellow,
          failed: chalk.red,
        };

        const rows = results.map((r) => {
          const colorFn = statusColors[r.status] ?? chalk.white;
          return {
            Platform: r.platform,
            Status: colorFn(r.status),
            "Gevonden": r.jobsFound ?? 0,
            "Nieuw": r.jobsNew ?? 0,
            "Duplicaten": r.duplicates ?? 0,
            "Duur (ms)": r.durationMs ?? "-",
            "Uitgevoerd op": r.runAt?.toLocaleString("nl-NL") ?? "-",
          };
        });

        console.table(rows);
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij ophalen geschiedenis");

        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian scraper toggle <platform> ──
  scraperCmd
    .command("toggle <platform>")
    .description("Scraper activeren/deactiveren")
    .action(async (platform: string) => {
      const spinner = ora(`Status van ${platform} wijzigen...`).start();
      try {
        const configs = await getAllConfigs();
        const cfg = configs.find(
          (c) => c.platform.toLowerCase() === platform.toLowerCase(),
        );

        if (!cfg) {
          spinner.fail(`Platform "${platform}" niet gevonden.`);
          console.log(
            chalk.gray(
              `Beschikbare platforms: ${configs.map((c) => c.platform).join(", ")}`,
            ),
          );
          process.exit(1);
          return;
        }

        const newState = !cfg.isActive;
        await updateConfig(cfg.id, { isActive: newState });

        spinner.succeed(
          `${chalk.bold(platform)} is nu ${newState ? chalk.green("ACTIEF") : chalk.red("INACTIEF")}`,
        );
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij wijzigen status");
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── motian scraper run ──
  scraperCmd
    .command("run")
    .description("Master scrape triggeren via Motia API")
    .action(async () => {
      const spinner = ora("Master scrape triggeren...").start();
      try {
        const baseUrl = process.env.MOTIA_API_URL ?? "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/scraper/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const body = await res.text();
          spinner.fail(`API fout: ${res.status} ${res.statusText}`);
          console.error(chalk.red(body));
          process.exit(1);
          return;
        }

        const data = await res.json();
        spinner.succeed("Master scrape getriggerd!");
        console.log(chalk.green(JSON.stringify(data, null, 2)));
        process.exit(0);
      } catch (err) {
        spinner.fail("Fout bij triggeren scrape");
        console.error(
          chalk.red(
            `Kon geen verbinding maken met API. Is de server actief?\n${String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}
