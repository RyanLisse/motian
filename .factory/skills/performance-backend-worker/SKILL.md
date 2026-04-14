---
name: performance-backend-worker
description: Handles runtime bootstrap, search/database performance, and API/query contract work for the Motian performance mission
---

# Performance Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use this skill for features that primarily touch:

- local runtime/bootstrap readiness
- environment-backed health and benchmark stability
- search and database hot paths
- service-layer caching/query tuning
- vacature search API and compatibility endpoint behavior

## Required Skills

- `systematic-debugging` — invoke before fixing any boot, benchmark, or runtime failure
- `verification-before-completion` — invoke before claiming the feature is complete

## Work Procedure

1. Read `features.json`, mission `AGENTS.md`, and `.factory/library/{architecture,user-testing,environment}.md`.
2. Reproduce the current problem first with the exact command or endpoint named in the feature.
3. Record the before-state in your notes and handoff:
   - failing command output, or
   - measured artifact values, or
   - failing HTTP/runtime response
4. If code changes affect service or API behavior, write focused failing tests first in `tests/`.
5. Implement the smallest change set that improves the approved hot path while preserving:
   - Dutch routes and recruiter terminology
   - compatibility search endpoints
   - Neon env-backed database usage
6. Prefer existing patterns:
   - `src/services/jobs/*` search/list modules
   - `next/cache` and `react` cache helpers
   - existing benchmark scripts and JSON artifacts
7. Run the narrowest relevant checks during iteration, then the feature’s required validators.
8. For API/bootstrap features, manually verify with `curl` and, when applicable, a local app run on port `3002`.
9. Before handing off, invoke `verification-before-completion` and ensure your handoff includes concrete before/after evidence.

## Example Handoff

```json
{
  "salientSummary": "Stabilized the local runtime bootstrap and vacancy-search benchmark path by fixing env-backed startup assumptions and trimming repeated request-time work in the search path. `pnpm metrics:search-path-latency`, `pnpm metrics:search-explain`, and `pnpm benchmark:hybrid-search` now complete successfully against the configured Neon database.",
  "whatWasImplemented": "Updated the runtime/bootstrap and search modules so the local app starts cleanly on port 3002, `/api/gezondheid` returns a valid JSON health payload, and the approved search/database benchmark commands produce their expected artifacts. Added focused regression coverage for the touched service and API behavior while preserving the existing recruiter-facing endpoint contracts.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "pnpm test -- tests/api-gezondheid-route.test.ts tests/vacatures-zoeken-route.test.ts --maxWorkers=5",
        "exitCode": 0,
        "observation": "Targeted route and contract coverage passed for the touched bootstrap and search endpoints."
      },
      {
        "command": "pnpm metrics:search-path-latency",
        "exitCode": 0,
        "observation": "Wrote docs/metrics/search-path-latency-latest.json with required scenario percentiles."
      },
      {
        "command": "pnpm metrics:search-explain",
        "exitCode": 0,
        "observation": "Wrote docs/metrics/search-path-explain-latest.json with explain payloads for documented search paths."
      },
      {
        "command": "pnpm benchmark:hybrid-search",
        "exitCode": 0,
        "observation": "Wrote docs/metrics/hybrid-search-benchmark-latest.json with limit-10, limit-100, and repeated-run summary."
      },
      {
        "command": "curl -sf http://localhost:3002/api/gezondheid",
        "exitCode": 0,
        "observation": "Returned a valid JSON health response from the local app."
      }
    ],
    "interactiveChecks": [
      {
        "action": "GET /api/vacatures/zoeken?q=developer&pagina=1&perPage=20",
        "observed": "Returned HTTP 200 with jobs, total, page, perPage, and totalPages."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/search-performance-contract.test.ts",
        "cases": [
          {
            "name": "preserves successful canonical and compatibility search envelopes",
            "verifies": "Recruiter-facing API contract stability after performance changes"
          },
          {
            "name": "keeps health route returning valid JSON",
            "verifies": "Bootstrap validation contract"
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires schema or `drizzle/` changes not already called for in the feature
- Search/database benchmarks are blocked by missing or invalid external credentials
- The required file already has unrelated dirty user changes and you cannot preserve them confidently
- The measured regression suggests a much larger architectural change than the feature describes
