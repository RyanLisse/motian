---
date: 2026-02-24
topic: harness-engineering-playbook
source: https://x.com/charlierguo/status/2026009225663750512
---

# The Emerging Harness Engineering Playbook

Based on insights from Charlie Guo (@charlierguo) regarding how elite engineering teams (like OpenAI and Stripe) are retooling their workflows to become "agent-native".

## What We Can Learn & Extract for Motian

### 1. The Shift to "Agent-Native" Engineering

- **Concept:** Engineers are moving from writing code ("makers") to orchestrating agents ("managers").
- **Example:** OpenAI built a 1M-line internal product in 5 months with 3 engineers and **zero hand-written code**.
- **Actionable Insight:** We should design our workflows expecting AI to write the bulk of the code, focusing our human effort on verifying plans and architecture.

### 2. "Harness Engineering"

- **Concept:** The practice of creating constraints and tools that keep AI productivity high and predictable.
- **Key Practices:**
  - **Architecture as Guardrails:** Strict, layered architectures help agents stay within boundaries.
  - **Tools as Foundation:** Expose internal tools via CLI or Model Context Protocol (MCP) so agents can use them natively.
  - **Documentation as System of Record:** Using files like `AGENTS.md` at the root level to document agent instructions, rules, and past mistakes so they compound knowledge over time.

### 3. "Planning is the New Coding"

- **Concept:** More time should be spent on writing detailed plans and verifying them before any code is generated.
- **Actionable Insight:** For future features in Motian, we must prioritize rigorous `task.md` and `plan.md` generation before executing.

### 4. Continuous Verification & Fighting Entropy

- **Challenge:** Agents can accumulate "cruft" or mark features complete without end-to-end testing.
- **Actionable Insight:** We need strong CI/CD checks, automated tests, and strict linters (the "harness") so agents are forced to produce high-quality, verified code. Don't accept "slop".

### 5. Multi-Agent Orchestration

- **Concept:** Instead of simple delegation, teams run 5-10 agents simultaneously (attended or unattended) to vastly increase PR throughput.
- **Actionable Insight:** Look into setting up asynchronous agent tasks for background work (e.g., writing tests, refactoring, or running our scrapers).

## Next Steps for Motian

1. **Create an `AGENTS.md`:** Add a root-level document to store our AI rules, architectural constraints, and recurring mistakes to prevent regressions in agent behavior.
2. **Expose Tools via CLI/MCP:** Ensure scripts (like our scrapers or database seeders) are easily executable by agents.
3. **Stricter Guardrails:** Enforce stronger linting and validation steps so agents get immediate feedback if they produce low-quality code.
