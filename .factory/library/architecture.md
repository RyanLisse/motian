# Architecture

Architectural decisions for the candidate matching recency + quality enhancement.

## Current Architecture

```
computeMatchScore(job, candidate)
├── computeSkillDimension() - ESCO or legacy keyword matching
├── computeRuleScore() - Rule-based scoring (skills, location, rate, role)
├── cosineSimilarity() - Vector similarity from embeddings
└── HYBRID_BLEND - 60% rule + 40% vector
```

## New Architecture

```
computeMatchScore(job, candidate, options?)
├── computeSkillDimension()
├── computeRuleScore()
├── cosineSimilarity()
├── computeRecencyScore()     [NEW]
│   └── lastMatchedAt time-decay
├── computeQualityScore()     [NEW]
│   └── jobMatches approval rate
├── applyWeights()            [NEW]
│   └── optional query-time weights
└── HYBRID_BLEND - with optional override
```

## Multi-Factor Scoring

The new system combines three factors:
1. **Relevance**: Rule-based + vector similarity (existing)
2. **Recency**: Time-decay based on `lastMatchedAt` (new)
3. **Quality**: Approval rate from `jobMatches` history (new)

### Factor Priority (Order of Operations)
1. Calculate base score (rule + vector hybrid)
2. Apply recency adjustment
3. Apply quality adjustment
4. Apply final cap (0-100)

## Backward Compatibility

- All existing function signatures preserved
- Optional `options` parameter with weights
- Defaults to existing env var behavior when not provided
