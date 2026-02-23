# Candidate Intelligence & Structured Matching

**Date:** 2026-02-23
**Status:** Brainstorm complete — ready for planning
**Origin:** Analysis of Custom GPT Mariënne matching methodology + user requirements

---

## What We're Building

A comprehensive "Candidate Intelligence" system with four parallel workstreams:

### 1. Structured Matching Pipeline (Mariënne-style)
Replace the current single-score hybrid matching (60% rules + 40% vector) with a **6-phase LLM-powered matching pipeline**:

1. **Requirement Extraction** — Parse job posting into classified requirements
2. **Tier Classification** — Knock-out (binary must-have), Gunningscriteria (star-rated), Process (not scored)
3. **Knock-out Testing** — Binary pass/fail per knockout criterion with CV evidence
4. **Qualitative Scoring** — 1-5 star rating per gunningscriterium with justification text
5. **Assessment Synthesis** — Overall match strength, risk profile, context fit, enrichment suggestions
6. **Conclusion** — Go/no-go recommendation with confidence level

### 2. CV Drag-and-Drop Upload + Profile Creation
- **Persistent sidebar panel** accessible from any page for quick CV drops
- Accepts Word (.docx) and PDF formats
- AI-powered CV parsing extracts: name, role, skills, experience, education, certifications
- Auto-creates or enriches candidate profile from parsed CV data

### 3. Skills Graph Visualization
- **Radar/spider chart** for overview comparison across skill categories
- **Tag cloud with proficiency bars** for detailed hard/soft skill breakdown
- Skills auto-extracted from CV and enriched by AI
- Enables visual candidate comparison

### 4. Markdown.fast Integration
- Sync structured match reports as publishable markdown
- Enable sharing match assessments with clients
- Terminal-based workflow: write locally, sync to cloud
- Reports accessible to browsers, LLMs, and AI agents

---

## Why This Approach

### Current State (Problems)
- **Single matchScore (0-100)** is meaningless to recruiters — "78% match" doesn't explain WHY
- **Flat reasoning text** is unstructured — can't scan, filter, or compare criteria
- **No evidence linking** — scores aren't tied to specific CV content
- **No requirement classification** — all job requirements treated equally
- **No CV upload** — candidates must be manually entered or scraped
- **No skills visualization** — skills stored as flat JSON array
- **No report generation** — match results live only in the app

### Target State (Mariënne Model)
- **Per-criterion scoring** with evidence from the CV
- **Tiered requirements** — knock-outs gate the process, gunningscriteria are qualitatively scored
- **Risk profiling** — identifies weak spots before recruiter reads the full assessment
- **Enrichment suggestions** — actionable advice to strengthen borderline matches
- **Go/no-go recommendation** — AI provides a clear recommendation, recruiter validates

### Why Full LLM Pipeline
The current rule-based scoring cannot produce evidence-based reasoning or per-criterion justification. Substring matching ("does the CV contain the word 'projectmanagement'?") is fundamentally different from understanding ("does 12 years at Heijmans demonstrate senior project management experience?"). Only an LLM can bridge that gap.

**Model choice:** Gemini 2.5 Flash (already used for job enrichment) — fast, cheap, structured output via Zod schemas.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **AI approach** | Full LLM pipeline | Need evidence-based reasoning per criterion; rules can't do this |
| **Schema strategy** | JSONB `criteriaBreakdown` column on jobMatches | Structured data without a separate table; queryable with PostgreSQL JSONB operators |
| **CV upload UX** | Persistent sidebar panel | Agent-native: accessible from any page, always ready |
| **Skills visualization** | Radar chart + tag cloud with proficiency bars | Radar for quick comparison, tags for detail |
| **Phasing** | All four workstreams in parallel | Swarm execution with clear interfaces between workstreams |
| **Primary goal** | All three: recruiter efficiency + client reports + AI accuracy | Government tenders require all three |
| **LLM model** | Gemini 2.5 Flash (existing integration) | Already in codebase, fast, structured output support |
| **CV parsing** | LLM-based extraction to structured Zod schema | More accurate than regex/rule-based parsing for Dutch CVs |
| **Report format** | Markdown via markdown.fast | Publishable, shareable, AI-agent readable |
| **Existing scoring** | Keep as fallback/fast-path | Rule-based scoring remains for bulk operations; LLM for detailed assessment |

---

## Schema Changes (Conceptual)

### jobMatches — New Fields
```
criteriaBreakdown: jsonb     — Array of per-criterion evaluations
riskProfile: jsonb           — Array of risk flags
enrichmentSuggestions: jsonb — Array of suggested enrichment actions
recommendation: text         — "go" | "no-go" | "conditional"
recommendationConfidence: real — 0-100
assessmentModel: text        — "marienne-v1" (pipeline version tracking)
```

### candidates — New/Enhanced Fields
```
resumeRaw: text              — Raw extracted CV text (for re-processing)
resumeParsedAt: timestamp    — When CV was last parsed
skillsStructured: jsonb      — { hard: [{name, proficiency, evidence}], soft: [{name, proficiency, evidence}] }
education: jsonb             — Structured education history
certifications: jsonb        — Array of certification objects
languageSkills: jsonb        — Array of {language, level} (CEFR scale)
```

### New Table: jobRequirements (optional, for caching)
```
id, jobId, criterion, tier (knockout|gunning|process), weight, extractedAt
```

---

## Interfaces Between Workstreams

```
CV Upload (WS2) ──→ Candidate Profile ──→ Skills Graph (WS3)
                         │
                         ▼
Job Requirements ──→ Structured Matcher (WS1) ──→ Match Report (WS4)
```

**Critical interface:** CV parsing must output to the same `skillsStructured` schema that the skills graph reads and the matcher evaluates against.

---

## Open Questions

1. **CV storage:** Store the actual file (S3/R2) or just the extracted text? Files enable re-parsing with improved models later.
2. **Requirement caching:** Extract job requirements once and cache in `jobRequirements` table, or re-extract per match? Caching is faster but requires invalidation.
3. **Markdown.fast auth:** How does markdown.fast handle authentication for private match reports? Need to investigate access control.
4. **Cost estimation:** Full LLM pipeline per match = ~2-3 Gemini Flash calls. At 1000 matches/day, what's the cost?
5. **Backward compatibility:** Existing matches with simple scores — migrate or leave as-is with `assessmentModel: "hybrid-v1"`?
6. **Government mode:** Mariënne has "Overheid – Strict" mode. Do we need configurable strictness levels?

---

## Success Criteria

- [ ] Recruiter can upload a CV via sidebar and see a parsed candidate profile within 10 seconds
- [ ] Match results show per-criterion breakdown with evidence from CV
- [ ] Knock-out criteria clearly gate the match (failed knock-out = flagged, not hidden)
- [ ] Skills graph renders radar chart and tag cloud for any candidate
- [ ] Match reports are publishable via markdown.fast
- [ ] Existing hybrid scoring continues to work as fast-path for bulk matching
- [ ] All structured data is queryable via PostgreSQL JSONB operators
