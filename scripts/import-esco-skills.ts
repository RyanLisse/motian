import fs from "node:fs/promises";
import { config as dotenvConfig } from "dotenv";
import { sql } from "drizzle-orm";

dotenvConfig({ path: ".env.local" });

import { db } from "../src/db";
import { escoSkills, skillAliases } from "../src/db/schema";
import { extractEscoSkillConcepts } from "../src/services/esco-dataset";
import { buildEscoImportBundle } from "../src/services/esco-import";

type RawEscoConcept = {
  uri?: unknown;
  preferredLabel?: {
    en?: unknown;
    nl?: unknown;
  };
  altLabels?: {
    en?: unknown;
    nl?: unknown;
  };
  broaderUri?: unknown;
  skillType?: unknown;
  reuseLevel?: unknown;
};

function readArg(flag: string): string | undefined {
  const flagIndex = process.argv.indexOf(flag);
  return flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
}

function toImportConcept(rawConcept: Record<string, unknown>): RawEscoConcept {
  return {
    uri: rawConcept.uri,
    preferredLabel:
      typeof rawConcept.preferredLabel === "object" && rawConcept.preferredLabel !== null
        ? (rawConcept.preferredLabel as RawEscoConcept["preferredLabel"])
        : undefined,
    altLabels:
      typeof rawConcept.altLabels === "object" && rawConcept.altLabels !== null
        ? (rawConcept.altLabels as RawEscoConcept["altLabels"])
        : undefined,
    broaderUri: rawConcept.broaderUri,
    skillType: rawConcept.skillType,
    reuseLevel: rawConcept.reuseLevel,
  };
}

async function main() {
  const filePath = readArg("--file");
  const escoVersion = readArg("--version");

  if (!filePath || !escoVersion) {
    console.error(
      "Gebruik: pnpm tsx scripts/import-esco-skills.ts --file <dataset.json> --version <esco-version>",
    );
    process.exit(1);
  }

  const rawFile = await fs.readFile(filePath, "utf-8");
  const payload = JSON.parse(rawFile) as unknown;
  const concepts = extractEscoSkillConcepts(payload);

  let importedSkills = 0;
  let importedAliases = 0;

  for (const conceptRecord of concepts) {
    const concept = toImportConcept(conceptRecord);
    if (
      typeof concept.uri !== "string" ||
      !concept.preferredLabel ||
      typeof concept.preferredLabel.en !== "string"
    ) {
      continue;
    }

    const bundle = buildEscoImportBundle({
      uri: concept.uri,
      preferredLabel: {
        en: concept.preferredLabel.en,
        nl: typeof concept.preferredLabel.nl === "string" ? concept.preferredLabel.nl : undefined,
      },
      altLabels: {
        en: Array.isArray(concept.altLabels?.en)
          ? concept.altLabels.en.filter((label): label is string => typeof label === "string")
          : typeof concept.altLabels?.en === "string"
            ? [concept.altLabels.en]
            : [],
        nl: Array.isArray(concept.altLabels?.nl)
          ? concept.altLabels.nl.filter((label): label is string => typeof label === "string")
          : typeof concept.altLabels?.nl === "string"
            ? [concept.altLabels.nl]
            : [],
      },
      broaderUri: typeof concept.broaderUri === "string" ? concept.broaderUri : undefined,
      skillType: typeof concept.skillType === "string" ? concept.skillType : undefined,
      reuseLevel: typeof concept.reuseLevel === "string" ? concept.reuseLevel : undefined,
    });

    await db
      .insert(escoSkills)
      .values({
        ...bundle.skill,
        escoVersion,
        rawConcept: conceptRecord,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: escoSkills.uri,
        set: {
          preferredLabelEn: sql`excluded.preferred_label_en`,
          preferredLabelNl: sql`excluded.preferred_label_nl`,
          broaderUri: sql`excluded.broader_uri`,
          skillType: sql`excluded.skill_type`,
          reuseLevel: sql`excluded.reuse_level`,
          escoVersion: sql`excluded.esco_version`,
          rawConcept: sql`excluded.raw_concept`,
          updatedAt: sql`now()`,
        },
      });
    importedSkills += 1;

    for (const alias of bundle.aliases) {
      await db
        .insert(skillAliases)
        .values({
          ...alias,
          escoUri: bundle.skill.uri,
          confidence: alias.source === "preferredLabel" ? 1 : 0.9,
        })
        .onConflictDoUpdate({
          target: [skillAliases.normalizedAlias, skillAliases.language, skillAliases.escoUri],
          set: {
            alias: sql`excluded.alias`,
            source: sql`excluded.source`,
            confidence: sql`excluded.confidence`,
          },
        });
      importedAliases += 1;
    }
  }

  console.log(
    `ESCO import voltooid: ${importedSkills} skills en ${importedAliases} aliases verwerkt voor versie ${escoVersion}.`,
  );
}

main().catch((error) => {
  console.error("ESCO import gefaald:", error);
  process.exit(1);
});
