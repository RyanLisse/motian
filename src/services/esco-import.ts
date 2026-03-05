type LocalizedLabels = Partial<Record<"en" | "nl", string | string[]>>;

type RawEscoConcept = {
  uri: string;
  preferredLabel: LocalizedLabels;
  altLabels?: LocalizedLabels;
  broaderUri?: string;
  skillType?: string;
  reuseLevel?: string;
};

type EscoSkillImportRow = {
  uri: string;
  preferredLabelEn: string;
  preferredLabelNl?: string;
  broaderUri?: string;
  skillType?: string;
  reuseLevel?: string;
};

type EscoAliasImportRow = {
  alias: string;
  normalizedAlias: string;
  language: "en" | "nl";
  source: "preferredLabel" | "altLabel";
};

export function normalizeAlias(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[.]/g, "")
    .replace(/-/g, "")
    .replace(/\//g, " ")
    .replace(/_/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("nl-NL");
}

function toLabelList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((label) => label.trim()).filter(Boolean);
}

export function buildEscoImportBundle(concept: RawEscoConcept): {
  skill: EscoSkillImportRow;
  aliases: EscoAliasImportRow[];
} {
  const preferredLabelEn = toLabelList(concept.preferredLabel.en)[0];

  if (!preferredLabelEn) {
    throw new Error(`ESCO concept ${concept.uri} is missing preferredLabel.en`);
  }

  const preferredLabelNl = toLabelList(concept.preferredLabel.nl)[0];
  const aliases: EscoAliasImportRow[] = [];
  const seenAliases = new Set<string>();

  const pushAliases = (
    labels: string[],
    language: "en" | "nl",
    source: "preferredLabel" | "altLabel",
  ) => {
    for (const alias of labels) {
      const normalizedAlias = normalizeAlias(alias);
      if (!normalizedAlias) continue;

      const dedupeKey = `${language}:${normalizedAlias}`;
      if (seenAliases.has(dedupeKey)) continue;
      seenAliases.add(dedupeKey);

      aliases.push({
        alias,
        normalizedAlias,
        language,
        source,
      });
    }
  };

  pushAliases(toLabelList(concept.preferredLabel.en), "en", "preferredLabel");
  pushAliases(toLabelList(concept.preferredLabel.nl), "nl", "preferredLabel");
  pushAliases(toLabelList(concept.altLabels?.en), "en", "altLabel");
  pushAliases(toLabelList(concept.altLabels?.nl), "nl", "altLabel");

  return {
    skill: {
      uri: concept.uri,
      preferredLabelEn,
      preferredLabelNl,
      broaderUri: concept.broaderUri,
      skillType: concept.skillType,
      reuseLevel: concept.reuseLevel,
    },
    aliases,
  };
}
