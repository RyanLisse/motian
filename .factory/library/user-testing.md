# User Testing

Testing surface and validation approach for candidate matching recency + quality features.

## Testable Surfaces

### 1. Scoring Service (src/services/scoring.ts)

**What can be tested:**
- computeMatchScore function output with various inputs
- Recency adjustment based on lastMatchedAt
- Quality adjustment based on jobMatches history
- Dynamic weight override behavior

**Resource cost:** Low - Unit tests only, no external services needed

**How to test:**
- Pass mock Job and Candidate objects with timestamps
- Verify score adjustments are applied correctly
- Check reasoning string contains expected explanations

### 2. Integration with Matching Inbox

**What can be tested:**
- listMatchingInboxCandidates returns candidates in correct order
- Recency and quality factors affect match rankings

**Resource cost:** Medium - Requires database connection

**How to test:**
- Create test candidates with different lastMatchedAt values
- Create test jobMatches with different approval rates
- Verify ranking reflects the factors

### 3. API Routes

**What can be tested:**
- /api/kandidaten/* endpoints return scores with new factors
- Backward compatibility with existing clients

**Resource cost:** Medium - Requires running server

**How to test:**
- Make API requests and verify response structure
- Check that optional weights parameter works

## Validation Approach

The validation contract contains 20 assertions across 3 areas:
- Recency: 6 assertions
- Quality: 6 assertions
- Dynamic Weights: 5 assertions
- Cross-Area: 3 assertions

All assertions are testable via unit tests (no UI testing required).

## Known Limitations

- Cannot easily test with real historical data (requires database seeding)
- Quality signal requires existing jobMatches data
- Integration tests may be flaky if database state changes
