---
name: performance-fullstack-worker
description: Handles route, layout, and client-side runtime performance work for the Motian performance mission
---

# Performance Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use this skill for features that primarily touch:

- route-level data loading and cache boundaries
- page/layout/sidebar runtime behavior
- recruiter workflow continuity across `/overzicht`, `/vacatures`, `/kandidaten`, `/pipeline`, and `/scraper`
- client render, hydration, and shell performance

## Required Skills

- `agent-browser` — use for browser verification of every user-facing behavior you change
- `systematic-debugging` — invoke before fixing runtime failures, broken routes, or hydration issues
- `verification-before-completion` — invoke before claiming the feature is complete

## Work Procedure

1. Read `features.json`, mission `AGENTS.md`, and `.factory/library/{architecture,user-testing,environment}.md`.
2. Inspect the exact route, layout, and component chain before changing anything.
3. Write focused failing tests first whenever the feature changes route, component, or workflow behavior.
4. Preserve existing patterns:
   - App Router server components by default
   - `unstable_cache` / `cache` where already used
   - Dutch route names and recruiter copy
   - canonical `/vacatures` and `/kandidaten` behavior
   - `/scraper` plus `/databronnen` alias behavior
5. Make the smallest change set that improves runtime speed while preserving downstream workflow links and compatibility surfaces.
6. Run targeted tests during iteration, then the feature’s required validators.
7. Start the local app on `3002` if needed and verify each changed behavior with `agent-browser`.
8. Capture at least one interactive check per changed user flow.
9. Before handoff, invoke `verification-before-completion` and verify the page still behaves correctly, not just faster.

## Example Handoff

```json
{
  "salientSummary": "Reduced runtime work on the vacatures shell and recruiter detail flow without changing user-facing behavior. The route now settles faster, keeps sidebar/list browsing intact, and preserves recruiter cockpit, AI grading, and downstream candidate/pipeline follow-up paths.",
  "whatWasImplemented": "Optimized the vacancies route/layout and related UI components to reduce duplicate runtime work while preserving list browsing, filter refinement, vacancy detail, and downstream recruiter actions. Added targeted regressions for the touched route workflow and verified the main recruiter flow in the browser.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "pnpm test -- tests/detail-surface-workflow.test.ts tests/recruiter-dashboard-navigation.test.ts tests/list-virtualization.test.ts --maxWorkers=5",
        "exitCode": 0,
        "observation": "Relevant structural and workflow regressions passed for the touched recruiter surfaces."
      },
      {
        "command": "pnpm perf:budget:shell",
        "exitCode": 0,
        "observation": "Canonical shell-route budgets passed after the change."
      },
      {
        "command": "pnpm lint",
        "exitCode": 0,
        "observation": "No new Biome issues in the touched route and component files."
      },
      {
        "command": "pnpm exec tsc --noEmit",
        "exitCode": 0,
        "observation": "No new TypeScript errors."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Open /vacatures, refine the list, open a vacancy detail, then return to the filtered list",
        "observed": "The route stayed responsive, recruiter cockpit and AI grading were visible, and the filtered list context was preserved after returning."
      },
      {
        "action": "Open /scraper and /databronnen",
        "observed": "Both entry points resolved to the operational scraper dashboard without a blank or crashed state."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/recruiter-runtime-performance-regressions.test.ts",
        "cases": [
          {
            "name": "preserves recruiter detail workflow after route performance work",
            "verifies": "List -> detail -> downstream recruiter flow stability"
          },
          {
            "name": "preserves scraper alias workflow parity",
            "verifies": "Scraper and databronnen route continuity"
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires modifying a dirty file with overlapping user changes you cannot preserve confidently
- The route or component behavior depends on a broken backend/bootstrap path outside the feature scope
- The fastest safe fix appears to require schema, migration, or external-service changes not called for by the feature
- Browser verification is blocked because the app cannot boot or the route cannot load at all
