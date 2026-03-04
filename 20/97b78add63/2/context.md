# Session Context

## User Prompts

### Prompt 1

check What’s in place

H1: parseHoursPerWeek returns 0 for some input (e.g. "0", "0 uur", or a range).
H2: Detail merge sets result.hoursPerWeek from summary even when the value is 0 (falsy check bug).
H3: Listing card sets hoursPerWeek from another field or typo that ends up as 0.
H4: Another numeric field (e.g. positionsAvailable) is wrongly assigned to hoursPerWeek.
H5: Merged object ends up with hoursPerWeek: 0 or minHoursPerWeek: 0 from spread/merge.
Instrumentation added:

normalize.ts ...

