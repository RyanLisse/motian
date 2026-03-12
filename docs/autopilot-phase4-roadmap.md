# Motian Autopilot Phase 4+ Roadmap

**Status**: Phase 0-3 Complete ✅ | Phase 4-6 Planned 📋

## Overview

Motian Autopilot MVP (Phase 0-3) delivers nightly browser audits with AI analysis, GitHub issue creation, database persistence, and a review UI at `/autopilot`. Phase 4-6 extends this foundation with:

- **Phase 4**: Rich evidence (video, trace, HAR)
- **Phase 5**: Autofix PR generation
- **Phase 6**: Learning loop & continuous improvement

## Phase 4: Rich Evidence Capture (12-16 hours)

**Goal**: Extend evidence capture to include video recordings, Playwright traces, and HAR network logs.

### Beads

| Bead | Title | Priority | Effort | Status |
|------|-------|----------|--------|--------|
| motian-ic0 | Video recording for all journeys | P2 | 2-3h | Open |
| motian-8w1 | Playwright trace capture | P2 | 2-3h | Open |
| motian-ucb | HAR network logs | P2 | 2h | Open |
| motian-9xn | Evidence viewer UI components | P1 | 4-6h | Open |
| motian-os7 | Storage optimization | P3 | 2h | Open |

### Dependencies

None - can start immediately.

### Implementation Notes

- **Video**: Add `recordVideo` config to browser context
- **Trace**: Start/stop tracing around journey execution
- **HAR**: Enable via `routeFromHAR` API
- **Storage**: 100-200MB per run, implement compression + 30-day TTL
- **Viewer**: Playwright trace viewer is web-based (iframe integration)

### Validation

1. Run nightly with all evidence types enabled
2. Verify uploads to Vercel Blob
3. Check evidence viewer displays all types correctly
4. Monitor storage costs

## Phase 5: Autofix PR Generation (35-47 hours)

**Goal**: Automatically generate pull requests with code fixes for detected findings.

### Beads

| Bead | Title | Priority | Effort | Dependencies |
|------|-------|----------|--------|--------------|
| 5.1 | Code locator (surface → files) | P2 | 6-8h | None |
| 5.2 | Fix generator (LLM-powered) | P2 | 8-10h | 5.1 |
| 5.3 | Fix validator (syntax/lint/test) | P2 | 4-6h | 5.2 |
| 5.4 | GitHub PR creator | P2 | 6-8h | 5.3 |
| 5.5 | Safety guardrails | P1 | 3-4h | None |
| 5.6 | Autofix orchestration | P2 | 4-6h | 5.1-5.5 |
| 5.7 | Autofix UI integration | P2 | 4-5h | 5.6 |

### Safety Guardrails

- **Severity limits**: Only low/medium severity fixes (no critical)
- **Confidence threshold**: Minimum 80% confidence
- **No auto-merge**: Always require human review
- **Test validation**: All tests must pass before PR creation

### Implementation Flow

```
Finding → Code Locator → Fix Generator → Validator → PR Creator → GitHub PR
              ↓              ↓             ↓            ↓
         Surface map    Gemini 2.0    TypeScript   API client
                        + evidence    + Biome      + branch
```

### Validation

1. Manual trigger for 3-5 test findings
2. Review generated PR quality
3. One week of nightly runs with autofix enabled
4. Measure PR merge rate

## Phase 6: Learning Loop (45-58 hours)

**Goal**: Learn from successful fixes to improve future attempts and reduce false positives.

### Beads

| Bead | Title | Priority | Effort | Dependencies |
|------|-------|----------|--------|--------------|
| 6.1 | Fix pattern storage | P2 | 6-8h | Phase 5 |
| 6.2 | Vector embeddings setup | P2 | 4-5h | 6.1 |
| 6.3 | Pattern matching (similarity) | P2 | 6-8h | 6.2 |
| 6.4 | Pattern application | P2 | 5-7h | 6.3 |
| 6.5 | GitHub webhook handler | P2 | 4-5h | None |
| 6.6 | Feedback processing | P2 | 5-6h | 6.5 |
| 6.7 | False positive tracking | P2 | 5-6h | None |
| 6.8 | Confidence adjustment | P2 | 4-5h | 6.7 |
| 6.9 | Learning dashboard UI | P2 | 6-8h | 6.1-6.8 |

### Learning Architecture

```
Successful Fix → Extract Pattern → Store with Embedding
                                         ↓
New Finding → Semantic Search → Find Similar Pattern → Apply & Adapt
                     ↓
               GitHub Webhook (PR merged/rejected)
                     ↓
          Update Pattern Success Metrics
                     ↓
          Adjust Future Confidence Scores
```

### Database Schema Additions

- `autopilot_fix_patterns`: Stores successful fix patterns with embeddings
- `autopilot_dismissals`: Tracks dismissed findings (false positives)
- `autopilot_learning_logs`: Audit log of learning events

### Validation

1. Merge 5+ autofix PRs to generate patterns
2. Verify pattern extraction and embedding
3. Test pattern matching on new findings
4. Measure false positive reduction (target: 30% decrease)

## Implementation Timeline

### Sprint 1 (Week 1): Phase 4 - Rich Evidence
- **Deliverable**: Video, trace, HAR capture working
- **Validation**: Run nightly, verify evidence uploads
- **Beads**: motian-ic0, motian-8w1, motian-ucb, motian-9xn, motian-os7

### Sprint 2-3 (Week 2-4): Phase 5 - Autofix Foundation
- **Deliverable**: Autofix generates PRs (manual + automated)
- **Validation**: Generate test PRs, review quality, monitor nightly runs
- **Beads**: 5.1-5.7

### Sprint 4-5 (Week 5-8): Phase 6 - Learning Loop
- **Deliverable**: Full learning loop with pattern reuse and FP reduction
- **Validation**: Measure pattern effectiveness, false positive reduction
- **Beads**: 6.1-6.9

## Risk Mitigation

### Phase 4 Risks

| Risk | Mitigation |
|------|------------|
| Storage costs | Compression + 30-day TTL, selective capture for failed journeys |
| Upload timeouts | Streaming uploads, 300s timeout |
| Large trace files | Enable only for failed journeys initially |

### Phase 5 Risks

| Risk | Mitigation |
|------|------------|
| Incorrect code location | Multi-stage validation, human review required |
| Generated code breaks app | Safety guardrails: severity limits, test validation |
| PR noise | Limit 3 PRs/run, batch similar fixes |
| LLM hallucinations | Multi-stage validation: syntax → lint → test → review |

### Phase 6 Risks

| Risk | Mitigation |
|------|------------|
| Pattern overfitting | Require 3+ successful merges before trusting |
| Webhook reliability | Retry logic, polling backup |
| Over-suppression | Manual override, quarterly review of dismissed findings |

## Success Metrics

### Phase 4
- ✅ All evidence types captured (video, trace, HAR)
- ✅ Evidence viewer displays all types correctly
- ✅ Storage costs < $50/month

### Phase 5
- ✅ 50% of autofixes merged without modification
- ✅ Zero breaking changes from autofixes
- ✅ 3+ PRs generated per nightly run

### Phase 6
- ✅ 30% reduction in false positives
- ✅ 5+ reusable fix patterns extracted
- ✅ 70%+ pattern application success rate

## Next Steps

1. **Start Phase 4**: Implement video recording (bead motian-ic0)
2. **Parallel work**: Set up storage optimization (bead motian-os7)
3. **Design Phase 5**: Create autofix system architecture
4. **Monitor Phase 3**: Review /autopilot UI feedback, iterate as needed

## References

- Phase 4+ Plan Agent Output: See conversation context
- Evidence Types: `src/autopilot/types/evidence.ts`
- GitHub Integration: `src/autopilot/github/`
- Database Schema: `packages/db/src/schema.ts`
