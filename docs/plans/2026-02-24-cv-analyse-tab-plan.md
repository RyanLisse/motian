---
date: 2026-02-24
topic: cv-analyse-tab
brainstorm: docs/brainstorms/2026-02-24-cv-analyse-tab-brainstorm.md
---

# CV Analyse Tab — Implementation Plan

## Overview

Replace the empty "CV Beheer" tab on `/matching` with a fully functional CV Analyse experience:
PDF drag-and-drop → parse → save candidate → auto-match all jobs → visual match cards + toggle PDF panel.

## Files to Create/Modify

### New Files (5)

1. **`app/api/cv-analyse/route.ts`** — Combined API: upload + parse + save + auto-match
2. **`app/matching/cv-analyse-tab.tsx`** — Client component: drop zone + results + PDF panel toggle
3. **`components/matching/cv-match-card.tsx`** — Visual match card (score ring, go/no-go, risks/strengths)
4. **`components/matching/cv-pdf-panel.tsx`** — Toggle side panel wrapping CvDocumentViewer
5. **`components/matching/recent-analyses.tsx`** — List of recent CV uploads with timestamps

### Modified Files (1)

1. **`app/matching/page.tsx`** — Replace "CV Beheer" empty state with `<CvAnalyseTab />`

## Implementation Steps

### Step 1: API Route — `app/api/cv-analyse/route.ts`

Combines existing services into one endpoint:
- Accept multipart/form-data with CV file
- Validate type (PDF/DOCX) and size (20MB max)
- Upload to Vercel Blob via `uploadFile()`
- Parse with `parseCV()` from `cv-parser.ts`
- Check duplicates with `findDuplicateCandidate()`
- Create or update candidate via `createCandidate()` / `enrichCandidateFromCV()`
- Run `autoMatchCandidateToJobs()` for full matching
- Return `{ candidate, matches[], fileUrl, parsed }`

### Step 2: Match Card — `components/matching/cv-match-card.tsx`

Visual card showing:
- `ScoreRing` (reuse existing component) — large, prominent
- Go/No-go/Conditional badge
- Job title + company
- Top 3 strengths (from criteriaBreakdown where stars >= 4 or passed === true)
- Top 3 risks (from riskProfile)
- `MatchActions` (reuse) for approve/reject
- Link to full match detail

### Step 3: PDF Panel — `components/matching/cv-pdf-panel.tsx`

- Toggle panel that slides in from right
- Wraps existing `CvDocumentViewer` component
- Close button, download button
- Candidate name header
- Fixed position, overlay on mobile, side panel on desktop

### Step 4: Recent Analyses — `components/matching/recent-analyses.tsx`

- Server component that queries candidates with `resumeParsedAt IS NOT NULL`
- Ordered by `resumeParsedAt DESC`, limit 10
- Shows: name, role, parsed date (relative: "2 min geleden")
- Click to load that candidate's matches

### Step 5: Main Tab — `app/matching/cv-analyse-tab.tsx`

Client component orchestrating:
- Drop zone (reuse drag pattern from `CvDropZone`)
- Upload state management (idle → uploading → matching → done)
- Display `CvMatchCard` grid when results arrive
- Toggle `CvPdfPanel` when "Bekijk CV" clicked
- Pass recent analyses data from server

### Step 6: Wire Into Page — `app/matching/page.tsx`

- Replace the `tab === "cv"` branch's EmptyState with server data fetch + `<CvAnalyseTab />`
- Query recent candidates with parsed CVs
- Pass to CvAnalyseTab as props

## Data Flow

```
User drops PDF
  → CvAnalyseTab handles drag events
  → POST /api/cv-analyse (FormData)
    → uploadFile() → Vercel Blob URL
    → parseCV() → ParsedCV
    → findDuplicateCandidate() → merge or create
    → createCandidate() or enrichCandidateFromCV()
    → autoMatchCandidateToJobs(candidateId) → AutoMatchResult[]
    → Response: { candidate, matches, fileUrl }
  → CvAnalyseTab renders CvMatchCard[] grid
  → User clicks "Bekijk CV" → CvPdfPanel opens with fileUrl
  → User clicks Goedkeuren/Afwijzen → MatchActions server action
```

## Reused Components & Services

| Existing | Used In |
|----------|---------|
| `ScoreRing` | CvMatchCard |
| `MatchActions` | CvMatchCard |
| `CvDocumentViewer` | CvPdfPanel |
| `parseCV()` | API route |
| `autoMatchCandidateToJobs()` | API route |
| `uploadFile()` | API route |
| `createCandidate()` | API route |
| `enrichCandidateFromCV()` | API route |
| `findDuplicateCandidate()` | API route |
