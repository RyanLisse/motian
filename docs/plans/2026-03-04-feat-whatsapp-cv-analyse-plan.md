# Feature Plan: WhatsApp CV Analyse via Baileys

**Date:** 2026-03-04
**Feature:** WhatsApp integration for CV upload + grading + vacancy matching
**Library:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web Node.js

---

## Summary

Users send a PDF/DOCX resume via WhatsApp → Motian processes it through the existing CV analysis pipeline → sends back grading results + top 5 matching vacatures as a formatted WhatsApp message.

---

## Architecture (OpenClaw-style)

```
WhatsApp User (sends CV)
    │
    ▼
WhatsApp Web protocol
    │
    ▼
Baileys (Node.js, event-driven)
    │  sock.ev.on("messages.upsert")
    ▼
WhatsApp Gateway Service (src/services/whatsapp.ts)
    │  Filters for document messages → downloads media
    ▼
CV Pipeline (src/services/whatsapp-cv-pipeline.ts)
    │  parseCV → grade → createCandidate → autoMatch(topN=5)
    ▼
Format Dutch response → sock.sendMessage()
    │
    ▼
WhatsApp User (receives results)
```

### Why Baileys over wacli

| | wacli | Baileys |
|---|---|---|
| **Type** | Go CLI tool | Node.js library |
| **Integration** | Shell exec, polling | Native JS, event-driven |
| **Real-time** | No (requires sync + poll) | Yes (WebSocket events) |
| **Media** | CLI download to disk | Direct Buffer in memory |
| **Stack fit** | External dependency | Same TypeScript stack |
| **Deployment** | Needs Go binary | npm install |

---

## Files to Create/Modify

### New Files (6)

| File | Purpose |
|------|---------|
| `src/services/whatsapp.ts` | Baileys gateway — connect, send, receive, download media |
| `src/services/whatsapp-cv-pipeline.ts` | Orchestrates CV processing for incoming WhatsApp documents |
| `src/schemas/whatsapp.ts` | Zod schemas for WhatsApp message tracking |
| `trigger/whatsapp-gateway.ts` | Trigger.dev long-running task to keep Baileys connection alive |
| `app/api/whatsapp/status/route.ts` | Health/auth status endpoint |
| `src/lib/grading-utils.ts` | Extract `computeGradeFromParsed` from cv-analyse route (shared) |

### Modified Files (3)

| File | Change |
|------|--------|
| `src/services/auto-matching.ts` | Add `topN` parameter (default 3, WhatsApp uses 5) |
| `app/api/cv-analyse/route.ts` | Import `computeGradeFromParsed` from shared utility |
| `package.json` | Add `@whiskeysockets/baileys` dependency |

---

## Implementation Details

### 1. `src/services/whatsapp.ts` — Baileys Gateway

```typescript
// Singleton WhatsApp connection manager
// Auth state persisted to filesystem (multi-device auth)

export class WhatsAppGateway {
  private sock: WASocket | null = null;
  private onCVReceived: ((msg: CVMessage) => void) | null = null;

  // Connect and start listening
  async connect(): Promise<void>

  // Send text message
  async sendText(jid: string, text: string): Promise<void>

  // Send file with caption
  async sendFile(jid: string, buffer: Buffer, filename: string, caption?: string): Promise<void>

  // Download media from message
  async downloadMedia(message: WAMessage): Promise<Buffer | null>

  // Register handler for incoming CV documents
  onDocument(handler: (msg: CVMessage) => void): void

  // Get connection status
  getStatus(): 'connected' | 'disconnected' | 'connecting'

  // Disconnect gracefully
  async disconnect(): Promise<void>
}
```

**Key design:**
- Singleton pattern — one connection per process
- Auth state stored in `data/whatsapp-auth/` (multi-device creds)
- QR code printed to terminal during first auth
- Auto-reconnect on disconnect
- Only processes document messages (PDF/DOCX), ignores everything else
- Rate limiting: max 5 CVs per phone number per hour

### 2. `src/schemas/whatsapp.ts` — Zod Schemas

```typescript
export const whatsappIncomingDocSchema = z.object({
  messageId: z.string(),
  senderJid: z.string(),
  senderName: z.string().nullable(),
  senderPhone: z.string(),
  fileName: z.string(),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  fileBuffer: z.instanceof(Buffer),
  timestamp: z.date(),
});

export const whatsappProcessedSchema = z.object({
  messageId: z.string(),
  senderPhone: z.string(),
  processedAt: z.date(),
  candidateId: z.string().nullable(),
  matchCount: z.number(),
  success: z.boolean(),
  error: z.string().nullable(),
});
```

### 3. `trigger/whatsapp-gateway.ts` — Long-Running Task

```typescript
// Trigger.dev task that maintains the Baileys WebSocket connection
// Uses machine preset for persistent execution
// On document received → triggers whatsapp-cv-process task
```

Alternative: Run gateway as a standalone process with `bun run src/services/whatsapp-runner.ts`

### 4. `src/services/whatsapp-cv-pipeline.ts` — Pipeline

Reuses existing services:
- `parseCV()` from `src/services/cv-parser.ts`
- `computeGradeFromParsed()` from `src/lib/grading-utils.ts`
- `findDuplicateCandidate()` / `createCandidate()` from `src/services/candidates.ts`
- `enrichCandidateFromCV()` from `src/services/candidates.ts`
- `autoMatchCandidateToJobs()` from `src/services/auto-matching.ts` (topN=5)
- `uploadFile()` from `src/lib/file-storage.ts`

```typescript
export async function processWhatsAppCV(doc: WhatsappIncomingDoc): Promise<WhatsAppCVResult> {
  // 1. Upload file to blob storage
  // 2. Parse CV with Gemini
  // 3. Grade CV
  // 4. Dedup / create candidate
  // 5. Auto-match top 5 vacatures
  // 6. Format response message
  // 7. Return formatted result
}

export function formatCVResultMessage(result: WhatsAppCVResult): string {
  // Returns Dutch formatted WhatsApp message with emoji
}
```

### 5. Response Format (Dutch)

```
📄 *CV Analyse — {name}*
_{role}_

━━━ Beoordeling ━━━
⭐ Score: {score}/100 — {label}

━━━ Profiel ━━━
📍 {location}
🎓 {highestEducation}
💼 {totalYears} jaar ervaring
🔧 {top 5 skills}

━━━ Top 5 Vacatures ━━━

1️⃣ *{jobTitle}*
   🏢 {company} | 📍 {location}
   💰 €{rateMin}-€{rateMax}/uur
   📊 Match: {score}% — {recommendation}

2️⃣ ...
3️⃣ ...
4️⃣ ...
5️⃣ ...

_Geen match? Stuur me een bericht en ik help je verder._

━━━━━━━━━━━━━━━━━━
🤖 _Motian AI Recruitment_
```

### 6. `src/lib/grading-utils.ts` — Shared Grading

Extract `computeGradeFromParsed` from `app/api/cv-analyse/route.ts` into a shared utility so both the web UI and WhatsApp pipeline use the same grading logic.

---

## Auto-Matching Change: TOP_N Parameter

Current `auto-matching.ts` has `TOP_N = 3` hardcoded. Make configurable:

```typescript
const DEFAULT_TOP_N = 3;

export async function autoMatchCandidateToJobs(
  candidateId: string,
  topN: number = DEFAULT_TOP_N
): Promise<AutoMatchResult[]>
```

Update `runAutoMatchPipeline` to accept `topN` parameter.

---

## Connection Lifecycle

1. **First time:** Run `bun run src/services/whatsapp-runner.ts` → QR code in terminal → scan with phone
2. **Subsequent:** Auth creds stored in `data/whatsapp-auth/`, auto-reconnects
3. **Production:** Run as Trigger.dev long-running task or standalone process
4. **Health check:** `GET /api/whatsapp/status` returns connection state

---

## Security & GDPR

- Rate limit: max 5 CV analyses per phone number per hour
- File validation: only PDF/DOCX, max 20MB
- Acknowledgment message includes GDPR notice about data processing
- Phone numbers not persisted beyond processing log
- Processing log auto-expires after 30 days
- No WhatsApp message content stored (only processing metadata)

---

## Build Sequence

1. `pnpm add @whiskeysockets/baileys` — install dependency
2. Create `src/schemas/whatsapp.ts` — Zod schemas
3. Create `src/lib/grading-utils.ts` — extract shared grading
4. Modify `app/api/cv-analyse/route.ts` — use shared grading
5. Modify `src/services/auto-matching.ts` — add topN parameter
6. Create `src/services/whatsapp.ts` — Baileys gateway
7. Create `src/services/whatsapp-cv-pipeline.ts` — pipeline orchestrator
8. Create `trigger/whatsapp-gateway.ts` — background task
9. Create `app/api/whatsapp/status/route.ts` — health endpoint
10. Test end-to-end

---

## Environment Variables

```bash
WHATSAPP_ENABLED=true          # Feature flag
WHATSAPP_AUTH_DIR=data/whatsapp-auth  # Auth state directory
WHATSAPP_RATE_LIMIT=5          # Max CVs per phone per hour
```
