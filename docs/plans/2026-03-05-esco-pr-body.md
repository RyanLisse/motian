# feat: ESCO Skills Canonical Matching

## Summary
Adds ESCO-first skill scoring: canonical skill mapping, link tables, and integration into match scoring and auto-matching. When enabled, the skill dimension uses ESCO URIs and criticality; guardrails fall back to legacy rule-based scoring when confidence is low.

## What was built
- **`src/services/esco.ts`** — Normalization, mapping (alias/exact), persistence of canonical links and mapping events; `getCandidateSkills` / `getJobSkills` and batch variants; `isEscoScoringEnabled()`.
- **`src/services/esco-scoring.ts`** — Pure skill subscore from canonical skill sets: critical/related weighting, guardrail fallback, Dutch reasoning strings; no DB access.
- **Scoring integration** — `src/services/scoring.ts` delegates the skill dimension to `computeEscoSkillScore` when ESCO is enabled; uses legacy skill score on guardrail fallback; `model` is `esco-hybrid-v1` when ESCO path is used.
- **Auto-matching integration** — `src/services/auto-matching.ts` loads candidate/job ESCO skills when `USE_ESCO_SCORING` is set, passes them into `computeMatchScore`, and persists `reasoning` and `model`.
- **Tests** — `tests/esco*.test.ts` for mapping, scoring, parity, and wiring.

## How to enable
Set **`USE_ESCO_SCORING=true`** (or `1` / non-empty string) in the environment.

## Post-deploy validation
- Confirm `USE_ESCO_SCORING` is set in the target environment.
- Run auto-match and check match results include `reasoning` and `model: "esco-hybrid-v1"` when ESCO path is used.
- If guardrail triggers, verify `reasoning` includes the fallback message.
- Run `pnpm test tests/esco*.test.ts` to confirm ESCO tests pass.

## Feature video
**Instructions:** Record a short walkthrough (2–3 min) showing: (1) Enabling ESCO via `USE_ESCO_SCORING=true`; (2) A candidate and job with canonical skills; (3) A match result with `model: esco-hybrid-v1` and ESCO reasoning. Attach the link below.

**Feature video link:** _(paste link here after recording)_
