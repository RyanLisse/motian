---
module: AI Services
date: 2026-02-23
problem_type: deprecation_migration
component: ai_sdk
symptoms:
  - "'generateObject' is deprecated — use generateText with Output.object() instead"
  - "AI SDK 6 deprecation warning on import"
root_cause: sdk_version_upgrade
severity: medium
tags: [ai-sdk, vercel, deprecation, migration]
---

# AI SDK 6: generateObject → generateText + Output.object()

## Symptom

After upgrading to AI SDK `^6.0.97`, `generateObject` is deprecated. The SDK logs a warning and the function will be removed in v7.

## Root Cause

AI SDK 6 unified `generateObject` and `generateText` to enable multi-step tool calling loops with structured output at the end. The standalone `generateObject` is no longer the recommended pattern.

## Solution

Mechanical migration across 4 files, 5 call sites:

### Before (AI SDK 5 pattern)

```ts
import { generateObject } from "ai";

const { object } = await generateObject({
  model: google("gemini-3-flash-preview"),
  schema: mySchema,
  system: SYSTEM_PROMPT,
  prompt: "...",
  providerOptions: { google: { structuredOutputs: true } },
});

return object;
```

### After (AI SDK 6 pattern)

```ts
import { generateText, Output } from "ai";

const { output } = await generateText({
  model: google("gemini-3-flash-preview"),
  output: Output.object({ schema: mySchema }),
  system: SYSTEM_PROMPT,
  prompt: "...",
  providerOptions: { google: { structuredOutputs: true } },
});

return output as MyType;
```

### Key differences

| Aspect | Before | After |
|--------|--------|-------|
| Import | `generateObject` | `generateText, Output` |
| Schema location | `schema:` top-level | `output: Output.object({ schema: })` |
| Result property | `{ object }` | `{ output }` |
| Null safety | Non-null | Nullable — needs `as Type` cast |

### Biome lint note

Biome's `noNonNullAssertion` rule disallows `output!`. Use `output as Type` instead — equally unsafe but communicates intent that structured output mode guarantees non-null.

## Files Changed

| File | Call sites |
|------|-----------|
| `src/services/cv-parser.ts` | 2 (PDF path + Word path) |
| `src/services/requirement-extraction.ts` | 1 |
| `src/services/structured-matching.ts` | 1 |
| `src/services/ai-enrichment.ts` | 1 |
| `tests/cv-parser.test.ts` | Updated string assertions |
| `tests/requirement-extraction.test.ts` | Updated string assertions |
| `tests/structured-matching.test.ts` | Updated string assertions |

## Prevention

Pin AI SDK major version in `package.json` and review migration guides before upgrading. The SDK provides Codemod transformations for automated migration.

## References

- [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6)
- [Migration guide 5.x → 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
