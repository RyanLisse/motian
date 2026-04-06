# OpenRouter Migration Guide

## Overview

This PR migrates Motian's AI infrastructure from multiple direct API providers (OpenAI, Google, xAI, Anthropic) to **OpenRouter** — a unified AI provider with automatic fallbacks and simplified API management.

## What Changed

| Before | After |
|--------|-------|
| 4+ API keys to manage | 1 OpenRouter API key |
| Direct provider SDKs | OpenRouter-compatible SDKs |
| Manual fallback logic | Automatic OpenRouter routing |
| 4 separate bills | 1 unified bill |

## Files Modified

- **`.env.example`** — New OpenRouter env vars + migration notes
- **`src/lib/openrouter.ts`** — New unified AI configuration
- **`src/lib/ai-models.ts`** — Backward compatibility maintained
- **`src/services/ai-enrichment.ts`** — Can use OpenRouter models

## Environment Variables

Add to your `.env.local`:

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxx

# Optional (defaults shown)
USE_OPENROUTER=true                    # Set 'false' to disable
OPENROUTER_VOICE_ENABLED=false       # Experimental — test first
```

## Migration Steps

1. **Get OpenRouter API Key**
   ```bash
   # Visit https://openrouter.ai/keys and create a key
   # Add to .env.local: OPENROUTER_API_KEY=sk-or-v1-xxx
   ```

2. **Verify Models**
   ```bash
   # Check available models on OpenRouter
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

3. **Test Chat Agent**
   ```bash
   pnpm dev
   # Open chat, verify responses work
   ```

4. **Test CV Parsing**
   ```bash
   # Upload a CV via UI
   # Check browser console for errors
   ```

5. **Test Embeddings**
   ```bash
   pnpm exec tsx scripts/test-embeddings.ts
   ```

6. **Voice Agent Decision**
   ```bash
   # Voice currently uses direct Google for native audio performance
   # To test OpenRouter voice, set OPENROUTER_VOICE_ENABLED=true
   # Benchmark latency: OpenRouter vs direct
   ```

7. **Remove Legacy Keys** (after testing)
   ```bash
   # Once OpenRouter is stable, remove from .env.local:
   # - ANTHROPIC_API_KEY
   # - OPENAI_API_KEY (keep if embeddings need it)
   # - X_AI_API_KEY
   # Keep GOOGLE_API_KEY for voice agent
   ```

## Model Mapping

| Function | Old | New | Via OpenRouter |
|----------|-----|-----|----------------|
| Chat | GPT-5 Nano | `openai/gpt-5-nano` | ✅ |
| CV Parse | Gemini 3 Flash | `google/gemini-3-flash` | ✅ |
| Judge | Grok 4 | `xai/grok-4` | ✅ |
| Embeddings | text-embedding-3-small | `openai/text-embedding-3-small` | ✅ |
| Voice | Gemini 2.5 Flash | **Direct Google** | ⚠️ Experimental |

## Voice Agent Note

LiveKit voice agent currently uses **direct Google** for Gemini 2.5 Flash Native Audio:

```typescript
// src/voice-agent/main.ts
import { voiceModels } from "@/lib/openrouter";

// Current (kept for performance)
const voice = shouldUseOpenRouterVoice()
  ? voiceModels.openrouter
  : voiceModels.native; // Direct Google
```

**Why:** Native audio streaming has lower latency when going direct to Google. OpenRouter adds ~100-300ms overhead.

**To test:** Set `OPENROUTER_VOICE_ENABLED=true` and benchmark.

## Benefits

1. **Simplified Ops** — 1 API key instead of 4+
2. **Automatic Fallbacks** — OpenRouter routes around outages
3. **Unified Billing** — Single invoice, easier cost tracking
4. **Future-Proof** — Access 200+ models as they release
5. **Better Analytics** — OpenRouter provides usage dashboards

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenRouter downtime | Fallback to direct APIs (set `USE_OPENROUTER=false`) |
| Higher latency | Keep direct Google for voice (native audio) |
| Model availability | Check OpenRouter model list before depending |
| Cost differences | Monitor OpenRouter dashboard for surprises |

## Testing Checklist

- [ ] Chat responds correctly
- [ ] CV upload + parse works
- [ ] Embeddings generate (check pgvector)
- [ ] Match judge (Grok) evaluates
- [ ] Voice agent still works (direct Google)
- [ ] No console errors
- [ ] Costs tracked in OpenRouter dashboard

## Rollback

If issues arise:

```bash
# Immediate rollback
echo "USE_OPENROUTER=false" >> .env.local
pnpm dev
```

Or revert the PR — backward compatibility maintained.

## References

- OpenRouter Docs: https://openrouter.ai/docs
- AI SDK + OpenRouter: https://sdk.vercel.ai
- LiveKit + OpenRouter: https://docs.livekit.io
- This PR: Initial OpenRouter migration for Motian

---

**Status:** Ready for testing
**Scope:** Chat, CV Parse, Embeddings, Match Judge
**Excluded:** Voice agent (kept on direct Google for now)
