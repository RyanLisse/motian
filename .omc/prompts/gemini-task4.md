# Task: Add agent onboarding flow + slash command help in chat

Working directory: /Users/cortex-air/Developer/motian

## Part A: Agent onboarding suggestions
1. Read components/chat/ directory to find the chat empty state or suggestion components
2. Find where suggested prompts/actions are shown to users
3. Add capability categories as suggestion chips:
   - Vacatures: "Zoek vacatures voor Java developer", "Analyseer tarief trends"
   - Kandidaten: "Voeg kandidaat toe", "Upload CV en match automatisch"  
   - Pipeline: "Toon pipeline overzicht", "Plan interview voor volgende week"
   - Data: "Start scraper voor Flextender", "Toon GDPR retentie status"
4. These should appear when the chat has no messages

## Part B: Slash command help
1. Read app/api/chat/route.ts to understand message processing
2. Add recognition for "/help" or "/hulp" messages
3. When detected, return a formatted response listing all capabilities in Dutch
4. Group by category with brief descriptions

After changes: run `pnpm tsc --noEmit` and `pnpm lint` to verify no errors.
