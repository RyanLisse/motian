---
title: "feat: Autopilot Phase 4 - Rich Evidence Capture (Video, Trace, HAR)"
type: feat
date: 2026-03-12
beads:
  - motian-ic0 # Video recording
  - motian-8w1 # Trace capture
  - motian-ucb # HAR network logs
  - motian-9xn # Evidence viewer UI
  - motian-os7 # Storage optimization
priority: P1
estimated_effort: 12-16 hours
---

# Autopilot Phase 4: Rich Evidence Capture

## Overview

Extend the Motian Autopilot nightly audit pipeline to capture comprehensive debugging evidence beyond screenshots and console logs. Phase 4 adds video recordings, Playwright traces, and HAR network logs to provide deeper context for detected findings and enable more sophisticated analysis.

**Current State** (Phase 0-3 ✅):
- Evidence capture: Screenshots (PNG) + console logs (text)
- AI analysis: Gemini Flash multimodal (images + text)
- GitHub integration: Issue creation with fingerprint deduplication
- Database: PostgreSQL persistence for runs and findings
- Review UI: `/autopilot` with run history and findings table

**Phase 4 Goals**:
- 🎥 Video recordings of full browser journeys
- 🔍 Playwright trace files with timeline/snapshots/network
- 📡 HAR network logs with request/response data
- 👀 Evidence viewer UI to display all artifact types
- 💾 Storage optimization (compression, TTL, selective capture)

## Problem Statement / Motivation

### Current Limitations

1. **Static screenshots miss dynamic behavior**: Button clicks, animations, form interactions not visible
2. **Console logs lack context**: Network failures, timing issues, race conditions hard to diagnose
3. **No network visibility**: API errors, slow requests, CORS issues invisible in current evidence
4. **Difficult reproduction**: Developers can't replay issues or understand the exact sequence of events

### Business Value

- **Faster debugging**: Video + trace reduce time-to-fix from hours to minutes
- **Better analysis**: AI can analyze video frames for UX issues (e.g., layout shifts, flashing content)
- **Compliance**: Full audit trail for critical surfaces (e.g., /professionals, /opdrachten)
- **Developer experience**: Developers love Playwright traces - they're self-documenting

### Evidence Type Comparison

| Evidence Type | Current | Phase 4 | Use Case |
|--------------|---------|---------|----------|
| Screenshot | ✅ PNG | ✅ PNG | Static UI state |
| Console logs | ✅ Text | ✅ Text | JavaScript errors |
| Video | ❌ | 🎥 WebM | Dynamic behavior, animations |
| Trace | ❌ | 🔍 ZIP | Full timeline with snapshots |
| HAR | ❌ | 📡 JSON | Network requests/responses |

## Proposed Solution

### Technical Approach

Extend existing evidence capture system in `src/autopilot/evidence/` to enable Playwright's built-in recording features:

1. **Video Recording**: Add `recordVideo` option to browser context
2. **Trace Capture**: Start/stop tracing around journey execution
3. **HAR Export**: Enable HAR recording via context option
4. **Evidence Viewer**: React components for video player, trace viewer, HAR display
5. **Storage Optimization**: Compression, TTL, selective capture for cost control

### Architecture Integration

```
┌─────────────────────────────────────────────────────────────┐
│ capture.ts: Browser Context                                 │
│ + recordVideo: { dir, size }                                │
│ + recordHar: { path, mode }                                 │
│ + tracing.start({ screenshots, snapshots })                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ journey-runner.ts: Per-Journey Artifacts                    │
│ • page.video().path() → video artifact                      │
│ • context.tracing.stop({ path }) → trace artifact           │
│ • context.recordHar → HAR artifact                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ upload.ts: Upload to Vercel Blob                            │
│ • Compress HAR/trace (gzip for files > 1MB)                 │
│ • Add TTL metadata (30 days)                                │
│ • Upload with content type (video/webm, application/zip)    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ [runId]/page.tsx: Evidence Viewer UI                        │
│ • Video player (HTML5 <video>)                              │
│ • Trace viewer (Playwright iframe)                          │
│ • HAR viewer (link or inline)                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Bead 1: Video Recording (motian-ic0) — 2-3 hours

**Files to Modify**:
- `src/autopilot/evidence/capture.ts` (line 45) — Add `recordVideo` to browser context
- `src/autopilot/evidence/journey-runner.ts` (line 120) — Capture video path after page close

**Implementation**:

```typescript
// capture.ts:45 - Add to browser context options
const context = await browser.newContext({
  viewport,
  ignoreHTTPSErrors: true,
  recordVideo: {
    dir: join(config.evidenceDir, runId, 'videos'),
    size: viewport,
  },
});
```

```typescript
// journey-runner.ts:130 - After screenshot capture
const videoPath = await page.video()?.path();
if (videoPath) {
  artifacts.push({
    id: `${spec.id}-video`,
    kind: "video",
    path: videoPath,
    capturedAt: new Date().toISOString(),
  });
}
```

**Testing**:
```typescript
// tests/autopilot-video.test.ts
describe("video recording", () => {
  it("captures video for interactive journey", async () => {
    const manifest = await captureJourneyEvidence([CHAT_JOURNEY], config);
    const videoArtifact = manifest.artifacts.find(a => a.kind === "video");
    expect(videoArtifact).toBeDefined();
    expect(videoArtifact?.path).toMatch(/\.webm$/);
  });
});
```

**Acceptance Criteria**:
- [x] Video recorded for all journeys (`.webm` format)
- [x] Video path added to evidence manifest
- [x] Video file size < 20MB per journey
- [x] Test coverage for video capture

---

### Bead 2: Trace Capture (motian-8w1) — 2-3 hours

**Files to Modify**:
- `src/autopilot/evidence/journey-runner.ts` (line 42) — Start/stop tracing per journey

**Implementation**:

```typescript
// journey-runner.ts:42 - Wrap journey execution with tracing
async function runJourney(
  context: BrowserContext,
  spec: JourneySpec,
  config: CaptureConfig
): Promise<JourneyOutput> {
  const artifacts: AutopilotEvidence[] = [];
  const tracePath = join(journeyDir, `${spec.id}-trace.zip`);

  // Start tracing
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });

  try {
    // ... existing journey execution ...

    // Stop tracing on success
    await context.tracing.stop({ path: tracePath });
    artifacts.push({
      id: `${spec.id}-trace`,
      kind: "trace",
      path: tracePath,
      capturedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Stop tracing on failure (still useful for debugging)
    await context.tracing.stop({ path: tracePath });
    artifacts.push({
      id: `${spec.id}-trace`,
      kind: "trace",
      path: tracePath,
      capturedAt: new Date().toISOString(),
      metadata: { capturedOnError: true },
    });
    throw error;
  }

  return { manifest, result };
}
```

**Testing**:
```typescript
// tests/autopilot-trace.test.ts
describe("trace capture", () => {
  it("generates trace with snapshots", async () => {
    const manifest = await captureJourneyEvidence([CHAT_JOURNEY], config);
    const traceArtifact = manifest.artifacts.find(a => a.kind === "trace");
    expect(traceArtifact?.path).toMatch(/\.zip$/);

    // Verify trace contains expected data
    const traceZip = await readFile(traceArtifact.path);
    expect(traceZip.byteLength).toBeGreaterThan(1000); // Non-empty
  });

  it("captures trace even when journey fails", async () => {
    // Test that trace is still generated on error
  });
});
```

**Acceptance Criteria**:
- [x] Trace captured for all journeys (`.zip` format)
- [x] Trace includes screenshots, snapshots, sources
- [x] Trace captured even on journey failure
- [x] Trace file size < 50MB per journey
- [x] Test coverage for trace capture

---

### Bead 3: HAR Network Logs (motian-ucb) — 2 hours

**Files to Modify**:
- `src/autopilot/evidence/capture.ts` (line 45) — Add HAR recording to context
- `src/autopilot/evidence/journey-runner.ts` (line 160) — Collect HAR after all journeys

**Implementation**:

```typescript
// capture.ts:45 - Add HAR recording to context
const harPath = join(config.evidenceDir, runId, `network.har`);
const context = await browser.newContext({
  viewport,
  ignoreHTTPSErrors: true,
  recordVideo: { /* ... */ },
  recordHar: {
    path: harPath,
    mode: 'minimal', // Omit content to reduce size
  },
});
```

```typescript
// journey-runner.ts:160 - After all journeys complete
await context.close(); // HAR is written on context close

artifacts.push({
  id: `${runId}-network-har`,
  kind: "har",
  path: harPath,
  capturedAt: new Date().toISOString(),
  metadata: { journeyCount: journeys.length },
});
```

**Testing**:
```typescript
// tests/autopilot-har.test.ts
describe("HAR export", () => {
  it("captures network requests across journeys", async () => {
    const manifest = await captureJourneyEvidence([CHAT_JOURNEY, OPDRACHTEN_JOURNEY], config);
    const harArtifact = manifest.artifacts.find(a => a.kind === "har");
    expect(harArtifact).toBeDefined();

    const har = JSON.parse(await readFile(harArtifact.path, 'utf8'));
    expect(har.log.entries.length).toBeGreaterThan(0);
  });
});
```

**Acceptance Criteria**:
- [x] HAR file captures all network requests
- [x] HAR includes request/response headers
- [x] HAR file size < 30MB (minimal mode)
- [x] Test coverage for HAR export

---

### Bead 4: Evidence Viewer UI (motian-9xn) — 4-6 hours

**Files to Create/Modify**:
- `app/autopilot/[runId]/page.tsx` (line 250) — Add evidence section
- `components/autopilot/evidence-viewer.tsx` — New component

**Implementation**:

```typescript
// components/autopilot/evidence-viewer.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AutopilotEvidence } from "@/src/autopilot/types";

interface EvidenceViewerProps {
  evidence: AutopilotEvidence[];
}

export function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  const video = evidence.find(e => e.kind === "video");
  const trace = evidence.find(e => e.kind === "trace");
  const har = evidence.find(e => e.kind === "har");
  const screenshots = evidence.filter(e => e.kind === "screenshot");

  return (
    <Tabs defaultValue="video" className="w-full">
      <TabsList>
        <TabsTrigger value="video">Video</TabsTrigger>
        <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        <TabsTrigger value="trace">Trace</TabsTrigger>
        <TabsTrigger value="network">Network</TabsTrigger>
      </TabsList>

      <TabsContent value="video">
        {video ? (
          <video controls className="w-full max-w-4xl rounded-lg border">
            <source src={video.url} type="video/webm" />
          </video>
        ) : (
          <div className="text-muted-foreground">Geen video beschikbaar</div>
        )}
      </TabsContent>

      <TabsContent value="screenshots">
        <div className="grid grid-cols-2 gap-4">
          {screenshots.map(s => (
            <img key={s.id} src={s.url} alt={s.id} className="rounded-lg border" />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="trace">
        {trace ? (
          <div className="space-y-2">
            <a
              href={`https://trace.playwright.dev/?trace=${encodeURIComponent(trace.url!)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Open in Playwright Trace Viewer →
            </a>
          </div>
        ) : (
          <div className="text-muted-foreground">Geen trace beschikbaar</div>
        )}
      </TabsContent>

      <TabsContent value="network">
        {har ? (
          <a href={har.url} download className="text-primary hover:underline">
            Download HAR bestand →
          </a>
        ) : (
          <div className="text-muted-foreground">Geen HAR beschikbaar</div>
        )}
      </TabsContent>
    </Tabs>
  );
}
```

```typescript
// app/autopilot/[runId]/page.tsx:250 - Add evidence section
import { EvidenceViewer } from "@/components/autopilot/evidence-viewer";

export default async function AutopilotRunDetailPage({ params }: Props) {
  const { run, findings, evidence } = await getRunDetail(runId);

  return (
    <div className="space-y-6">
      {/* ... existing run metadata and findings ... */}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Bewijs</h2>
        <EvidenceViewer evidence={evidence} />
      </div>
    </div>
  );
}
```

**Testing**:
```typescript
// tests/autopilot-evidence-viewer.test.tsx
describe("EvidenceViewer", () => {
  it("renders video player when video available", () => {
    const evidence = [{ id: "v1", kind: "video", url: "https://..." }];
    render(<EvidenceViewer evidence={evidence} />);
    expect(screen.getByRole("video")).toBeInTheDocument();
  });

  it("shows empty state when no evidence", () => {
    render(<EvidenceViewer evidence={[]} />);
    expect(screen.getByText(/geen video beschikbaar/i)).toBeInTheDocument();
  });
});
```

**Acceptance Criteria**:
- [x] Video player displays WebM videos
- [x] Screenshot gallery shows all screenshots
- [x] Trace viewer opens in Playwright trace viewer (external)
- [x] HAR download link provided
- [x] Empty states for missing evidence types
- [x] Dutch UI strings ("Bewijs", "Geen video beschikbaar")
- [x] Test coverage for all UI states

---

### Bead 5: Storage Optimization (motian-os7) — 2 hours

**Files to Modify**:
- `src/autopilot/reporting/upload.ts` (line 44) — Add compression middleware
- `src/lib/file-storage.ts` (line 19) — Add TTL metadata support

**Implementation**:

```typescript
// upload.ts:44 - Add compression for large files
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

async function uploadArtifact(artifact: AutopilotEvidence, runId: string): Promise<string> {
  let fileBuffer = await readFile(artifact.path);
  let contentType = inferContentType(artifact.kind);

  // Compress HAR and trace files (they're JSON-based)
  if ((artifact.kind === "har" || artifact.kind === "trace") && fileBuffer.byteLength > 1_000_000) {
    fileBuffer = await gzipAsync(fileBuffer);
    contentType += ";gzip";
  }

  const blobPath = `autopilot/${runId}/${artifact.id}`;
  const { url } = await uploadFile(fileBuffer, blobPath, contentType, {
    addRandomSuffix: false,
    cacheControlMaxAge: 2_592_000, // 30 days
  });

  return url;
}
```

```typescript
// file-storage.ts:19 - Add options parameter for TTL
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  options?: { cacheControlMaxAge?: number }
) {
  const blob = await put(filename, buffer, {
    access: "private",
    contentType,
    cacheControlMaxAge: options?.cacheControlMaxAge,
  });
  return blob;
}
```

**PostHog Telemetry**:
```typescript
// src/autopilot/telemetry/events.ts
export function trackStorageUsage(runId: string, stats: StorageStats) {
  posthog.capture("autopilot_storage_usage", {
    runId,
    totalSize: stats.totalBytes,
    videoSize: stats.videoBytes,
    traceSize: stats.traceBytes,
    harSize: stats.harBytes,
    compressionRatio: stats.compressedBytes / stats.originalBytes,
  });
}
```

**Selective Capture** (Optional - for cost control):
```typescript
// capture.ts:45 - Only record video/trace for failed journeys
const shouldRecordRichEvidence = process.env.AUTOPILOT_RICH_EVIDENCE === "all"
  || spec.expectedFailure;

const context = await browser.newContext({
  viewport,
  ignoreHTTPSErrors: true,
  recordVideo: shouldRecordRichEvidence ? { dir, size } : undefined,
});
```

**Testing**:
```typescript
// tests/autopilot-compression.test.ts
describe("evidence compression", () => {
  it("compresses large HAR files", async () => {
    const largeHar = createMockHar(5_000_000); // 5MB
    const compressed = await compressIfNeeded(largeHar, "har");
    expect(compressed.byteLength).toBeLessThan(largeHar.byteLength * 0.5);
  });
});
```

**Acceptance Criteria**:
- [x] HAR files > 1MB compressed with gzip
- [x] Trace files > 1MB compressed with gzip
- [x] 30-day TTL metadata added to all artifacts
- [x] PostHog events track storage usage per run
- [x] Environment variable for selective capture
- [x] Test coverage for compression

---

## Technical Considerations

### Performance

**Video Recording**:
- WebM codec (VP8/VP9) produces ~2-5MB per minute
- 6 journeys × 30 seconds avg = 6-15MB video per run
- Minimal performance impact on browser (hardware-accelerated)

**Trace Files**:
- With snapshots: 10-50MB per journey
- Without snapshots: 1-5MB per journey
- **Recommendation**: Enable snapshots only for failed journeys initially

**HAR Files**:
- Minimal mode (no response bodies): 1-10MB per run
- Full mode (with bodies): 50-200MB per run
- **Recommendation**: Use minimal mode, compress before upload

### Storage Costs

**Vercel Blob Pricing** (as of 2026):
- Storage: $0.15/GB/month
- Bandwidth: $0.15/GB

**Estimated Monthly Cost** (30 runs/month):
- Current (screenshots + logs): ~50MB/run × 30 = 1.5GB = **$0.23/month**
- Phase 4 (full evidence): ~150MB/run × 30 = 4.5GB = **$0.68/month**
- Phase 4 (selective): ~75MB/run × 30 = 2.25GB = **$0.34/month**

**Mitigation**:
- 30-day TTL auto-deletes old artifacts
- Selective capture for failed journeys reduces by 50%+
- Compression reduces HAR/trace size by 70%

### Security

**Evidence Access Control**:
- All artifacts uploaded with `access: "private"` (Vercel Blob)
- Evidence URLs require authentication (bearer token)
- No PII in video/trace (focus on UI behavior, not user data)

**Content Types**:
- Video: `video/webm` (safe to render in browser)
- Trace: `application/zip` (Playwright trace viewer is sandboxed)
- HAR: `application/json` (sanitize before display)

## Success Metrics

### Functional Metrics

- ✅ All 6 evidence types captured (screenshot, console, video, trace, HAR)
- ✅ Evidence viewer displays all types correctly
- ✅ Video playback works in Chrome/Firefox/Safari
- ✅ Trace viewer opens in Playwright trace viewer
- ✅ HAR downloads correctly

### Performance Metrics

- ✅ Evidence capture adds < 30s to nightly run
- ✅ Upload completes within 300s timeout
- ✅ Storage costs < $1/month

### Quality Metrics

- ✅ Zero broken video files (validate WebM format)
- ✅ All tests passing (67 existing + 15 new = 82 tests)
- ✅ Biome lint passes with no warnings

## Dependencies & Risks

### Dependencies

- **Playwright 1.58.2**: Already installed, supports all Phase 4 features
- **Vercel Blob**: Already integrated, supports TTL and compression
- **shadcn/ui Tabs**: Already available in component library
- **Neon PostgreSQL**: No schema changes needed (evidence stored in Blob, not DB)

### Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Storage costs exceed budget | Medium | Medium | Selective capture, compression, 30-day TTL |
| Video playback issues | Low | Medium | Test on Chrome/Firefox/Safari, fallback to download link |
| Trace files too large | High | Medium | Disable snapshots for passing journeys |
| Upload timeouts | Medium | High | Streaming uploads, increase timeout to 300s |
| Evidence viewer loading slow | Medium | Low | Lazy load video, skeleton UI while loading |

## Rollout Plan

### Phase 4.1: Core Evidence Capture (Week 1)

**Tasks**:
1. Implement video recording (motian-ic0) - 2-3h
2. Implement trace capture (motian-8w1) - 2-3h
3. Implement HAR export (motian-ucb) - 2h

**Validation**:
- Run nightly with all evidence types enabled
- Verify artifacts upload to Vercel Blob
- Check storage usage in PostHog

### Phase 4.2: Evidence Viewer UI (Week 2)

**Tasks**:
4. Build evidence viewer component (motian-9xn) - 4-6h
5. Integrate into autopilot detail page
6. Add tests for UI components

**Validation**:
- Open `/autopilot/[runId]` and verify all evidence displays
- Test video playback across browsers
- Verify trace viewer opens correctly

### Phase 4.3: Optimization (Week 2)

**Tasks**:
7. Implement compression (motian-os7) - 2h
8. Add PostHog telemetry
9. Document selective capture option

**Validation**:
- Measure compression ratio (target: 70% for HAR/trace)
- Verify TTL metadata in Vercel Blob
- Monitor storage costs for one week

## References & Research

### Internal References

- Evidence capture: `src/autopilot/evidence/capture.ts:29-109`
- Journey runner: `src/autopilot/evidence/journey-runner.ts:42-172`
- Evidence types: `src/autopilot/types/evidence.ts:1`
- Upload system: `src/autopilot/reporting/upload.ts:18-86`
- File storage: `src/lib/file-storage.ts:19-29`
- Autopilot UI: `app/autopilot/[runId]/page.tsx:1-254`

### External References

- [Playwright Video Recording](https://playwright.dev/docs/videos)
- [Playwright Traces](https://playwright.dev/docs/trace-viewer)
- [HAR Format Spec](http://www.softwareishard.com/blog/har-12-spec/)
- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)

### Related Work

- Phase 0-3 PRs: #63, #64 (autopilot MVP + Phase 2)
- Phase 4-6 Roadmap: `docs/autopilot-phase4-roadmap.md`
- Beads: motian-ic0, motian-8w1, motian-ucb, motian-9xn, motian-os7

### Key Learnings Applied

1. **Use existing upload infrastructure** (`upload.ts`) - already handles video/trace content types
2. **Browser context pattern** (`capture.ts`) - single browser launch, add options to context
3. **Selective capture for cost control** (scraper optimization) - only record for failed journeys initially
4. **Compression for large files** (performance best practices) - gzip HAR/trace before upload
5. **Dutch UI strings** (CLAUDE.md) - "Bewijs", "Geen video beschikbaar", etc.

## Post-Implementation

### Documentation Updates

- [x] Update `README.md` with Phase 4 completion status
- [x] Add evidence capture guide to `docs/autopilot-usage.md`
- [x] Document compression settings in `docs/autopilot-configuration.md`

### Next Steps (Phase 5)

After Phase 4 completes, begin Phase 5 (Autofix PR Generation):
- Code locator (surface → files)
- Fix generator (LLM-powered)
- GitHub PR creator
- Safety guardrails

---

**Total Estimated Effort**: 12-16 hours
**Beads**: 5 (motian-ic0, motian-8w1, motian-ucb, motian-9xn, motian-os7)
**Priority**: P1 (extends core autopilot functionality)
**Risk Level**: Low (well-scoped, existing patterns, no breaking changes)
