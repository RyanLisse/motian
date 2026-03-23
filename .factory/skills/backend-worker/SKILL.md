# Backend Worker Skill

This skill handles backend implementation tasks for the Motian recruitment platform, focusing on scoring logic, API endpoints, and database operations.

## When to Use This Skill

Use this skill when implementing:
- Scoring/matching logic enhancements
- API route implementations
- Database queries and mutations
- Service layer business logic

## Procedure

### 1. Pre-Flight Check

Before starting any work:
1. Read the feature description in `features.json`
2. Read relevant existing code (e.g., `src/services/scoring.ts`)
3. Check test files for patterns and coverage expectations
4. Verify environment requirements

### 2. Implement the Feature

Follow the expected behavior in the feature description:
- Make minimal, focused changes
- Match existing code style and patterns
- Add proper TypeScript types
- Handle edge cases identified in validation contract

### 3. Testing

- Write unit tests in `tests/` directory
- Test file naming: `{feature}-test.test.ts`
- Run tests: `pnpm test -- --grep '<feature-name>'`
- Ensure backward compatibility

### 4. Quality Gates

Before completing:
1. Run `pnpm lint` - MUST pass
2. Run tests - MUST pass
3. Verify no new TypeScript errors

### 5. Handoff

When complete, provide a structured handoff with:
- Summary of changes made
- Test coverage added
- Any discovered issues
- Recommendations for next steps
