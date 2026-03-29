---
module: Agent System
date: 2026-03-29
problem_type: workflow_issue
component: background_job
symptoms:
  - "0-5 minute delay between agent event creation and processing"
  - "agent-orchestrator cron running every 2 minutes consuming Trigger.dev compute"
  - "Events persisted as pending and polled instead of dispatched immediately"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: medium
tags: [event-driven, orchestrator, trigger-dev, cron, polling, dispatch, agent-system, latency]
---

# Troubleshooting: Agent Orchestrator Polling Replaced with Event-Driven Dispatch

## Problem
The multi-agent system used a polling-based orchestrator cron that ran every 2 minutes, querying the `agent_events` table for "pending" events and dispatching them to downstream Trigger.dev tasks. This introduced 0-5 minute latency for every agent event and consumed unnecessary Trigger.dev compute (720 invocations/day even when no events existed).

## Environment
- Module: Agent System
- Framework: Next.js 16 + Trigger.dev v4 + Drizzle ORM
- Affected Component: `trigger/agent-orchestrator.ts`, `src/services/agent-events.ts`, `trigger/agent-communicator.ts`
- Date: 2026-03-29

## Symptoms
- `candidate.parsed` events took 0-5 minutes before the matcher agent was triggered
- `match.created` email notifications were delayed by the polling interval
- `agent-orchestrator` cron ran every 2 minutes, even when no pending events existed — wasting Trigger.dev compute
- The orchestrator had to look up candidate email before triggering the communicator — coupling business logic into the scheduler

## What Didn't Work

**Direct solution:** The problem was identified and fixed on the first attempt by recognizing that `emitAgentEvent()` was the single chokepoint through which all events flowed.

## Solution

Added `dispatchEvent()` directly into `emitAgentEvent()` so downstream Trigger.dev tasks are triggered immediately after event insertion.

**Key change in `src/services/agent-events.ts`:**
```typescript
export async function emitAgentEvent(input: EmitEventInput) {
  const [event] = await db.insert(agentEvents).values({...}).returning();

  // SSE broadcast for real-time dashboard
  ssePublish(`agent:${input.eventType}`, {...});

  // NEW: Dispatch to downstream tasks immediately
  try {
    await dispatchEvent(event);
  } catch (dispatchErr) {
    // Log but don't fail — event is persisted and fallback cron catches it
    console.error(`[agent-events] Dispatch failed:`, dispatchErr);
  }

  return event;
}
```

**Dispatch uses string task IDs** to avoid circular imports:
```typescript
async function dispatchEvent(event) {
  const { tasks } = await import("@trigger.dev/sdk");

  switch (event.eventType) {
    case "candidate.parsed":
      await tasks.trigger("agent-matcher", { mode: "candidate", candidateId: event.candidateId, topN: 5 });
      break;
    case "match.created":
      await tasks.trigger("agent-communicator", { channel: "email", template: "match_notification", ... });
      break;
    // ... other event types
  }
}
```

**Communicator auto-resolves recipient:** Previously the orchestrator looked up candidate email before triggering communicator. Now the communicator does this itself when `recipient` is omitted.

**Orchestrator demoted to hourly fallback:** Still exists at `0 * * * *` as a safety net for any events stuck in "pending" status due to dispatch failures.

## Why This Works

1. **Single chokepoint:** Every agent event flows through `emitAgentEvent()`. Adding dispatch there guarantees immediate processing without changing any callers.
2. **Dynamic import** (`await import("@trigger.dev/sdk")`) handles both Trigger.dev and Vercel contexts gracefully — in Vercel where the SDK may not be configured, dispatch silently skips while the event is still persisted.
3. **String task IDs** (`tasks.trigger("agent-matcher", ...)`) prevent circular dependencies between `src/services/` and `trigger/` directories.
4. **Hourly fallback** ensures reliability — any missed dispatch gets caught within the hour.

## Prevention

- When designing event-driven systems, prefer synchronous dispatch at the point of event creation over polling
- Use string-based task identifiers to avoid circular import chains between service layers and task definitions
- Dynamic imports (`await import()`) are the correct pattern for optional SDK dependencies that may not be available in all runtime contexts
- Keep a low-frequency fallback poller as a safety net — events should never be lost

## Related Issues

- See also: [vercel-fluid-compute-spike-Pipeline-20260329.md](../performance-issues/vercel-fluid-compute-spike-Pipeline-20260329.md) — related cron frequency reduction that motivated this change
- See also: [scraper-analytics-schedule-optimization-ScraperSystem-20260223.md](../workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md) — similar Trigger.dev cron optimization
