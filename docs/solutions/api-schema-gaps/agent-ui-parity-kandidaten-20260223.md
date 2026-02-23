---
module: Kandidaten
date: 2026-02-23
problem_type: api_schema_gap
component: api_route
symptoms:
  - "PATCH /api/kandidaten/[id] only accepts 6 of 12+ editable fields"
  - "AI agent updateKandidaat tool missing phone, notes, hourlyRate, availability, linkedinUrl, headline"
  - "Notes are read-only once set — no append functionality"
  - "Candidates not searchable by skills or role in chat"
root_cause: incomplete_schema
severity: medium
tags: [agent-native, zod, api-parity, search]
---

# Agent/UI Parity Gap — Kandidaten PATCH + Search

## Symptom

Recruiters could create candidates with all fields but could not edit `phone`, `notes`, `hourlyRate`, `availability`, `linkedinUrl`, or `headline` after creation. The AI agent had the same limitation — its `updateKandidaat` and `maakKandidaatAan` tools only exposed 6 fields. Additionally, `zoekKandidaten` only searched by name and location, not by skills or role.

## Root Cause

The Zod schema in `app/api/kandidaten/[id]/route.ts` (line 9-16) was defined with only 6 fields when the DB schema supports 12+. The AI tool schemas in `src/ai/tools/kandidaten.ts` mirrored this limitation. The `searchCandidates` service in `src/services/candidates.ts` had no conditions for skills or role filtering.

## Solution

### 1. Widened PATCH API schema

```ts
// app/api/kandidaten/[id]/route.ts
const updateCandidateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),           // NEW
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  linkedinUrl: z.string().url().optional(), // NEW
  headline: z.string().optional(),          // NEW
  hourlyRate: z.number().optional(),        // NEW
  availability: z.string().optional(),      // NEW
  notes: z.string().optional(),             // NEW
});
```

### 2. Added skills/role search

```ts
// src/services/candidates.ts — searchCandidates()
if (opts.role) {
  conditions.push(ilike(candidates.role, `%${escapeLike(opts.role)}%`));
}
if (opts.skills) {
  conditions.push(
    sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${candidates.skills}) AS s WHERE s ILIKE ${`%${escapeLike(opts.skills)}%`})`,
  );
}
```

### 3. Added append-only notes service + API

```ts
// src/services/candidates.ts
export async function addNoteToCandidate(id: string, note: string): Promise<Candidate | null> {
  // Timestamps and appends rather than replacing
  const timestamp = new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });
  const newNote = `[${timestamp}] ${note}`;
  const combined = existing.notes ? `${existing.notes}\n\n${newNote}` : newNote;
  // ...
}
```

### 4. New AI tool: `voegNotitieToe`

Registered in `src/ai/agent.ts` alongside the widened `updateKandidaat` and `maakKandidaatAan` tools.

### 5. Inline edit UI + notes component

- `components/edit-candidate-fields.tsx` — click-to-edit fields with auto-PATCH
- `components/candidate-notes.tsx` — notes display + append form

## Files Changed

| File | Change |
|------|--------|
| `app/api/kandidaten/[id]/route.ts` | Widened PATCH Zod schema |
| `app/api/kandidaten/[id]/notities/route.ts` | NEW — POST append note |
| `src/ai/tools/kandidaten.ts` | Widened tools, added `voegNotitieToe`, extended search |
| `src/ai/tools/index.ts` | Exported new tool |
| `src/ai/agent.ts` | Registered tool, updated prompt |
| `src/services/candidates.ts` | Added `addNoteToCandidate`, extended `searchCandidates` |
| `components/edit-candidate-fields.tsx` | NEW — inline field editing |
| `components/candidate-notes.tsx` | NEW — notes append UI |
| `app/professionals/[id]/page.tsx` | Wired in edit + notes components |

## Prevention

When adding new DB columns to the schema, always update all three layers:
1. **API route** Zod schema
2. **AI tool** Zod schema
3. **Service function** type definition

A checklist in the PR template would catch this.
