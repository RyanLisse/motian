export function extractEscoSkillConcepts(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("ESCO payload does not contain a supported concept list");
  }

  const wrappedPayload = payload as {
    skills?: unknown;
    concepts?: unknown;
  };

  if (Array.isArray(wrappedPayload.skills)) {
    return extractEscoSkillConcepts(wrappedPayload.skills);
  }

  if (Array.isArray(wrappedPayload.concepts)) {
    return extractEscoSkillConcepts(wrappedPayload.concepts);
  }

  throw new Error("ESCO payload does not contain a supported concept list");
}
