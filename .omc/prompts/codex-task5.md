# Task: Refactor structured-match into primitives + prompt orchestration

Working directory: /Users/cortex-air/Developer/motian

## Goal
Ensure the gestructureerde_match tool is a thin primitive wrapper, with all orchestration logic in the service layer.

## Steps
1. Read src/mcp/tools/advanced-matching.ts — check if tool contains business logic
2. Read src/services/structured-matching.ts — check if orchestration is here
3. Read src/services/requirement-extraction.ts — check separation
4. Read src/ai/tools/structured-match.ts — check AI tool version

## What to fix
- If the MCP tool contains orchestration (requirement extraction, evaluation loops, scoring), move it to structured-matching.ts service
- The tool should only: validate input → call service function → return result
- The service owns: requirement extraction, structured evaluation, scoring
- If already properly separated, document that in a brief comment

After changes: run `pnpm tsc --noEmit` and `pnpm lint` to verify no errors.
