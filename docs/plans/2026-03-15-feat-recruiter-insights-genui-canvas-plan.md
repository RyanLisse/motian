---
title: "feat: Recruiter Insights — GenUI Expansion + Canvas View"
type: feat
date: 2026-03-15
deepened: 2026-03-15
---

# Recruiter Insights — GenUI Expansion + Canvas View

## Enhancement Summary

**Deepened on:** 2026-03-15
**Research agents used:** architecture-strategist, performance-oracle, kieran-typescript-reviewer, agent-native-reviewer, spec-flow-analyzer, genui-best-practices-researcher

### Key Improvements from Research
1. **Lazy registry pattern** for GENUI_COMPONENTS — dynamic imports keep recharts/xyflow out of initial chat bundle
2. **A2UI path clarified** — CopilotKit has a React renderer (`createA2UIMessageRenderer`), but requires replacing entire chat stack. Keep current approach, add A2UI as Phase 4
3. **Bidirectional canvas** — AI should read canvas state, not just write to it (agent-native finding)
4. **Memoization strategy** — Prevent re-render storms when `useChat` updates all messages
5. **Documented learning applied** — Agent/UI parity gap pattern from `docs/solutions/api-schema-gaps/` confirms action cards need full field coverage

---

## Overview

Transform the Motian AI chat from a text-with-cards experience into a **rich insight engine** for recruiters. Three pillars:

1. **Expanded GenUI Components** — More tool outputs render as interactive, actionable cards (not just detail lookups)
2. **Inline Analytics & Comparison** — AI can render charts, comparison tables, and funnel views directly in chat
3. **Canvas View** — A visual workspace using `@xyflow/react` (already installed) where recruiters can see candidate-vacancy relationships, pipeline flows, and matching networks

### A2UI Assessment (Updated)

Google's [A2UI](https://github.com/google/A2UI) (v0.8) is a declarative JSON format for agent-driven UI.

**React renderer exists via CopilotKit:** `createA2UIMessageRenderer` from `@copilotkitnext/a2ui-renderer` can render A2UI JSON into React components. However, it requires:
- Replacing `useChat`/`streamText` with CopilotKit's `CopilotKitProvider` + `CopilotChat`
- AG-UI protocol as transport layer (replacing our direct Vercel AI SDK streaming)
- A2A protocol for agent ↔ backend communication

**The [ai-kit-nextjs-a2ui](https://github.com/AINative-Studio/ai-kit-nextjs-a2ui) repo** is a placeholder (3 commits, no actual code) — not usable.

**Decision:** Continue with Vercel AI SDK client-side GenUI pattern for Phases 1-3. Add **Phase 4: A2UI Migration** as future work once CopilotKit's renderer matures and we evaluate whether the stack swap is worth the migration cost. Our component catalog already follows a declarative mapping pattern, making migration mechanical.

## Problem Statement

Recruiters currently get:
- ✅ Text answers from AI
- ✅ 3 basic GenUI cards (opdracht, kandidaat, match detail)
- ❌ No inline data visualization (charts, comparisons)
- ❌ No actionable cards (approve match, schedule interview, move pipeline stage)
- ❌ No visual overview of relationships (which candidates match which vacancies)
- ❌ No "workspace" for complex multi-step recruitment decisions
- ❌ Search results still render as generic JSON tool calls

## Proposed Solution

### Phase 1: GenUI Expansion (Core)

Expand the `GENUI_COMPONENTS` mapping in `chat-messages.tsx` with new component types.

#### Research Insight: Lazy Registry Pattern

**From architecture review:** Replace static imports with a lazy registry to avoid bundling recharts + xyflow in the initial chat chunk:

```typescript
// components/chat/genui/registry.ts
import { type ComponentType, lazy } from "react";

type GenUIEntry = {
  component: React.LazyExoticComponent<ComponentType<{ output: unknown }>>;
  /** Display name shown while loading */
  label: string;
};

export const GENUI_REGISTRY: Record<string, GenUIEntry> = {
  getOpdrachtDetail: {
    component: lazy(() => import("./opdracht-card").then(m => ({ default: m.OpdrachtGenUICard }))),
    label: "Opdracht",
  },
  queryOpdrachten: {
    component: lazy(() => import("./opdracht-list").then(m => ({ default: m.OpdrachtListCard }))),
    label: "Opdrachten",
  },
  analyseData: {
    component: lazy(() => import("./insight-chart").then(m => ({ default: m.InsightChart }))),
    label: "Analyse",
  },
  // ... all other mappings
};
```

**Usage in chat-messages.tsx:**

```tsx
import { Suspense } from "react";
import { GENUI_REGISTRY } from "./genui/registry";

// In the render loop:
const entry = name ? GENUI_REGISTRY[name] : undefined;
if (toolPart.state === "output-available" && entry && toolPart.output !== undefined) {
  const GenUICard = entry.component;
  return (
    <Suspense key={partKey} fallback={<GenUILoadingSkeleton label={entry.label} />}>
      <GenUICard output={toolPart.output} />
    </Suspense>
  );
}
```

**Why:** Recharts alone is ~180KB gzipped. XYFlow is ~120KB. Lazy loading keeps initial chat bundle lean — components load on first tool use (~50-100ms).

#### 1a. Search Result Cards (Lists)

| Tool | Current | New GenUI |
|------|---------|-----------|
| `queryOpdrachten` | JSON blob | Scrollable card list with title, company, rate, deadline |
| `zoekKandidaten` | JSON blob | Candidate cards with name, role, skills tags, availability |
| `zoekMatches` | JSON blob | Match cards with score ring, candidate+vacancy names |
| `zoekSollicitaties` | JSON blob | Pipeline cards with stage badge, candidate, vacancy |
| `zoekInterviews` | JSON blob | Interview cards with date, type, interviewer |

#### Research Insight: List Card Pattern

```tsx
// Shared pattern for all list GenUI components
function GenUIList<T>({
  items,
  renderItem,
  emptyMessage,
  maxVisible = 5,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage: string;
  maxVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, maxVisible);

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="my-2 space-y-2">
      {visible.map(renderItem)}
      {items.length > maxVisible && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-xs text-primary">
          + {items.length - maxVisible} meer tonen
        </button>
      )}
    </div>
  );
}
```

#### 1b. Analytics Cards

| Tool | New GenUI |
|------|-----------|
| `analyseData` | Inline recharts (bar/line/pie) based on data type |
| `getSollicitatieStats` | Pipeline funnel visualization |
| `autoMatchKandidaat` / `matchKandidaten` | Comparison table with score breakdowns |

#### Research Insight: Chart Type Inference

```tsx
// insight-chart.tsx — auto-detect chart type from data shape
type ChartData = {
  type?: "bar" | "line" | "pie" | "funnel";
  data: Array<Record<string, unknown>>;
  xKey?: string;
  yKey?: string;
  title?: string;
};

function inferChartType(data: ChartData): "bar" | "line" | "pie" {
  if (data.type) return data.type;
  const keys = Object.keys(data.data[0] ?? {});
  // Time series → line chart
  if (keys.some(k => k.includes("date") || k.includes("datum"))) return "line";
  // Few categories → pie chart
  if (data.data.length <= 6 && keys.length === 2) return "pie";
  // Default → bar
  return "bar";
}
```

#### 1c. Action Cards

| Tool | New GenUI |
|------|-----------|
| `maakMatchAan` | Match created confirmation with "Approve" / "Reject" buttons |
| `keurMatchGoed` / `wijsMatchAf` | Status change confirmation card |
| `updateSollicitatieFase` | Pipeline stage transition card with animation |
| `planInterview` | Interview scheduled card with calendar link |
| `stuurBericht` | Message sent confirmation with preview |

#### Research Insight: Action Card Pattern with Optimistic Updates

```tsx
// action-card.tsx — generic action card with optimistic state
type ActionCardProps = {
  output: unknown;
  actions: Array<{
    label: string;
    variant: "default" | "destructive" | "outline";
    endpoint: string;
    method: "POST" | "PUT" | "DELETE";
    body: Record<string, unknown>;
    confirmMessage?: string;
  }>;
  successMessage: string;
};

function ActionCard({ output, actions, successMessage }: ActionCardProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleAction = async (action: ActionCardProps["actions"][0]) => {
    if (action.confirmMessage && !confirm(action.confirmMessage)) return;
    setStatus("loading");
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  // ... render with status-dependent UI
}
```

**From agent/UI parity learning (`docs/solutions/api-schema-gaps/`):** Ensure action cards send all required fields — previous gap where PATCH endpoints only accepted 6 of 12+ fields caused silent failures.

### Phase 2: Inline Insights Dashboard

A new GenUI component type: `InsightsDashboard` — rendered when the AI detects the recruiter is asking analytical questions.

**Trigger:** When `analyseData` tool returns structured data, or when the AI uses multiple tools to compose an answer.

**Components:**
- `StatCardRow` — KPI metrics inline (reuse existing `kpi-card.tsx` pattern)
- `InlineChart` — recharts wrapper that accepts `{ type, data, config }` from tool output
- `ComparisonTable` — Side-by-side candidate or vacancy comparison
- `FunnelView` — Pipeline conversion funnel from `sollicitatieStats`

#### Research Insight: Recharts Performance in Chat

- **Wrap charts in `React.memo`** — prevent re-renders when other chat messages update
- **Set fixed `width`/`height`** — avoid layout shift from `ResponsiveContainer`
- Use `ResponsiveContainer` only once chart is visible (IntersectionObserver)
- **Chart animation:** Set `isAnimationActive={false}` for charts that appear in already-scrolled-past messages

```tsx
const MemoizedChart = React.memo(function InlineChart({ data }: { data: ChartData }) {
  return (
    <div className="my-2 rounded-lg border bg-card p-4" style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        {/* chart content */}
      </ResponsiveContainer>
    </div>
  );
});
```

### Phase 3: Canvas View (Visual Workspace)

A new route `/canvas` or panel within `/chat` using `@xyflow/react`.

**Decision from architecture review:** Use a **resizable split panel** within `/chat` rather than a separate route. This keeps the chat context visible while exploring the canvas. Use `react-resizable-panels` (or a simple CSS grid approach).

**Use cases:**
1. **Match Network** — Visualize candidate↔vacancy matches as a bipartite graph
   - Nodes: candidates (left) + vacancies (right)
   - Edges: matches with score as label, color-coded by confidence
   - Click node → detail sidebar
   - Right-click → approve/reject match

2. **Pipeline Flow** — Kanban-like but as a flow diagram
   - Nodes: candidates at each stage
   - Edges: stage transitions with timestamps
   - Bottleneck highlighting (stages with high dwell time)

3. **Recruiter Action Board** — AI-generated "what needs attention" as a canvas
   - Priority-ordered nodes for pending actions
   - Grouped by urgency (red/amber/green)

#### Research Insight: Bidirectional Canvas (Agent-Native)

**From agent-native review:** The AI should not just _write_ to the canvas — it should also _read_ canvas state. This enables:
- "What's on my canvas right now?" → AI describes current view
- "Focus on this cluster" → AI filters/highlights based on visible nodes
- User drags nodes → AI notices grouping and suggests actions

```typescript
// New tool: readCanvasState
const readCanvasState = tool({
  description: "Read current canvas state — visible nodes, edges, selection, viewport",
  parameters: z.object({}),
  execute: async () => {
    // Canvas state stored in a zustand store, accessible server-side via API
    return { nodes, edges, selectedNodeIds, viewport };
  },
});
```

#### Research Insight: XYFlow Performance

- **Limit visible nodes to 100** — paginate or cluster beyond that
- Use `nodeTypes` with `React.memo` on custom nodes
- Enable `fitView` on initial render, not on every data change
- Use `useNodesState`/`useEdgesState` hooks (not external state) for best performance
- **Dynamic import:** `const ReactFlow = dynamic(() => import("@xyflow/react").then(m => m.ReactFlow), { ssr: false })`

**AI Integration:** The AI can populate the canvas via a new tool `renderCanvas({ type, data })` that returns node/edge definitions.

### Phase 4: A2UI Migration Path (Future)

**When to evaluate:** When CopilotKit's `@copilotkitnext/a2ui-renderer` reaches v1.0 and AG-UI transport stabilizes.

**Migration approach:**
1. Map existing `GENUI_REGISTRY` entries to A2UI component catalog
2. Replace `useChat` → `CopilotKitProvider` + `CopilotChat`
3. Replace `streamText` → A2A agent backend
4. Keep all GenUI React components — they become the A2UI "catalog"

**Benefit:** Third-party agents could render UI in Motian's chat using the same component catalog.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Chat Messages (chat-messages.tsx)               │
│  ┌───────────────────────────────────────────┐  │
│  │ GENUI_REGISTRY (lazy imports)             │  │
│  │ ─────────────────────────────             │  │
│  │ getOpdrachtDetail → lazy(OpdrachtCard)    │  │
│  │ queryOpdrachten → lazy(OpdrachtList)  NEW │  │
│  │ analyseData → lazy(InsightChart)      NEW │  │
│  │ getSollicitatieStats → lazy(Funnel)   NEW │  │
│  │ maakMatchAan → lazy(ActionCard)       NEW │  │
│  │ renderCanvas → lazy(CanvasEmbed)      NEW │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  Each wrapped in <Suspense fallback={skeleton}>  │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Split Panel (resizable)                         │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Chat        │  │  Canvas (@xyflow)       │  │
│  │  (scrollable)│  │  MatchNetworkCanvas     │  │
│  │              │  │  PipelineFlowCanvas     │  │
│  │              │  │  ActionBoardCanvas      │  │
│  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Files to Create

```
components/chat/genui/
├── registry.ts               # Lazy component registry (replaces static GENUI_COMPONENTS)
├── genui-loading-skeleton.tsx # Shared loading state for lazy components
├── genui-list.tsx             # Shared list wrapper (pagination, empty state)
├── opdracht-list.tsx          # Search results list
├── kandidaat-list.tsx         # Candidate search results
├── match-list.tsx             # Match search results
├── sollicitatie-list.tsx      # Application search results
├── interview-list.tsx         # Interview search results
├── insight-chart.tsx          # Inline recharts wrapper (auto-detect chart type)
├── pipeline-funnel.tsx        # Funnel visualization
├── comparison-table.tsx       # Side-by-side comparison
├── action-card.tsx            # Generic action confirmation with optimistic updates
├── stat-card-row.tsx          # Inline KPI metrics
└── canvas-embed.tsx           # Canvas split-panel launcher

components/canvas/
├── match-network-canvas.tsx   # Bipartite match graph
├── pipeline-flow-canvas.tsx   # Pipeline as flow
├── action-board-canvas.tsx    # Priority action board
├── canvas-node-types.tsx      # Custom XYFlow node types (React.memo)
├── canvas-sidebar.tsx         # Detail sidebar on node click
└── canvas-controls.tsx        # Zoom, filter, layout controls
```

### Files to Modify

```
components/chat/chat-messages.tsx:33-39
  → Replace static GENUI_COMPONENTS with lazy GENUI_REGISTRY + Suspense wrapper
  → Add React.memo to individual message rendering

components/chat/genui/index.ts
  → Re-export registry instead of individual components

src/ai/tools/
  → Add renderCanvas tool definition
  → Add readCanvasState tool definition

src/ai/agent.ts
  → Register renderCanvas + readCanvasState in tool groups
```

### Implementation Phases

#### Phase 1: GenUI Search Results + Analytics (MVP)
- [x] Create `genui/registry.ts` with lazy import pattern
- [x] Create `genui/genui-utils.ts` shared utilities (error guards, toDate, labels)
- [x] Create `genui/genui-loading-skeleton.tsx` loading state
- [x] Create 5 list card components (opdracht, kandidaat, match, sollicitatie, interview)
- [x] Create `insight-chart.tsx` with recharts + auto chart type detection
- [x] Create `pipeline-funnel.tsx` for sollicitatie stats
- [ ] Create `comparison-table.tsx` for match comparisons
- [x] Create `stat-card-row.tsx` for inline KPIs
- [x] Refactor `chat-messages.tsx` to use lazy registry + Suspense
- [x] Add `React.memo` to analytics components to prevent re-render storms
- **Success:** All search/analytics tools render rich UI instead of JSON

#### Phase 2: Action Cards
- [x] Create `action-card.tsx` with configurable actions + optimistic updates
- [x] Wire action buttons to existing API routes via fetch
- [ ] Ensure all API endpoints accept full field set (ref: agent-ui-parity learning)
- [x] Handle confirmation dialogs for destructive actions
- [x] Add success/error overlay states
- **Success:** Recruiters can approve matches, schedule interviews, move pipeline stages directly from chat

#### Phase 3: Canvas View
- [x] Dynamic import `@xyflow/react` (no SSR)
- [x] Create custom node types with `React.memo`
- [x] Implement `MatchNetworkCanvas` (bipartite graph, max 100 nodes)
- [ ] Implement `PipelineFlowCanvas` (stage visualization)
- [x] Add `renderCanvas` AI tool (write to canvas)
- [ ] Add `readCanvasState` AI tool (read from canvas — bidirectional)
- [x] Create canvas embed in chat via GenUI registry
- [x] Add canvas sidebar for node details + actions
- **Success:** Recruiters can visually explore candidate-vacancy relationships

#### Phase 4: A2UI Evaluation (Future)
- [ ] Evaluate CopilotKit `@copilotkitnext/a2ui-renderer` maturity
- [ ] Prototype: Render one GenUI component via A2UI JSON
- [ ] Assess migration cost: `useChat` → `CopilotKitProvider`
- [ ] Decision: migrate or keep current approach

## Acceptance Criteria

### Functional Requirements
- [ ] All 5 search tools render card lists instead of JSON
- [ ] `analyseData` renders appropriate chart type (bar/line/pie) based on data structure
- [ ] `getSollicitatieStats` renders a pipeline funnel
- [ ] Match comparison shows side-by-side score breakdowns
- [ ] Action cards trigger real API calls and show confirmation
- [ ] Canvas view renders match network from AI query results
- [ ] Canvas nodes are clickable with detail sidebar
- [ ] AI can read canvas state (bidirectional)
- [ ] All new components have error states and loading states
- [ ] Dutch UI strings throughout

### Non-Functional Requirements
- [ ] GenUI cards render within 100ms of tool output (lazy load on first use)
- [ ] Initial chat bundle does NOT include recharts or xyflow (lazy loaded)
- [ ] Canvas handles 50+ nodes at 60fps (memo'd custom nodes)
- [ ] All components work on mobile (cards stack, canvas hidden on <768px)
- [ ] Recharts renders without layout shift (fixed dimensions)
- [ ] No re-render storms — memo'd message components

### Edge Cases (from spec-flow analysis)
- [ ] Empty search results show Dutch empty state message
- [ ] Chart with 0 or 1 data point shows meaningful fallback
- [ ] Action card after navigation away: action still succeeds (fire-and-forget)
- [ ] Canvas with no matches shows "Geen matches gevonden" empty state
- [ ] Long chat sessions (50+ messages with tool outputs) don't degrade performance
- [ ] Concurrent action cards (approve two matches) don't conflict

## Success Metrics

| Metric | Target |
|--------|--------|
| GenUI coverage | 15+ tools with custom cards (up from 3) |
| Recruiter actions from chat | >50% of approve/reject done inline |
| Canvas adoption | Used by >30% of sessions within first month |
| JSON tool call visibility | <10% of tool outputs shown as raw JSON |
| Initial chat bundle size | No increase (lazy loading) |
| Chart render time | <200ms from tool output to visible chart |

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| `@xyflow/react` bundle size (~120KB) | Dynamic import with `next/dynamic`, no SSR |
| Recharts bundle size (~180KB) | Lazy import, only loaded on first chart tool use |
| Action cards need auth context | Reuse existing session cookies — fetch inherits auth |
| Canvas performance with many nodes | React.memo custom nodes, limit 100 visible, cluster overflow |
| Re-render storms in chat | React.memo on message components, stable keys |
| API field coverage for action cards | Audit all PATCH endpoints against DB schema (ref: agent-ui-parity learning) |
| A2UI ecosystem evolves with React support | Our component catalog maps 1:1 to a declarative format — migration is mechanical |
| CopilotKit A2UI renderer replaces our approach | Phase 4 evaluation planned — keep architecture compatible |

## References

- Existing GenUI brainstorm: `docs/brainstorms/2026-03-02-genui-chat-brainstorm.md`
- Current GenUI components: `components/chat/genui/`
- GENUI_COMPONENTS mapping: `components/chat/chat-messages.tsx:35-39`
- XYFlow (installed): `@xyflow/react` in package.json
- Vercel AI SDK GenUI docs: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- Google A2UI: https://github.com/google/A2UI
- CopilotKit A2UI renderer: https://www.copilotkit.ai/blog/build-with-googles-new-a2ui-spec-agent-user-interfaces-with-a2ui-ag-ui
- ai-kit-nextjs-a2ui (placeholder): https://github.com/AINative-Studio/ai-kit-nextjs-a2ui
- Agent/UI parity learning: `docs/solutions/api-schema-gaps/agent-ui-parity-kandidaten-20260223.md`
- AI SDK deprecation learning: `docs/solutions/deprecations/generateobject-to-generatetext-ai-sdk6-20260223.md`
- Recharts docs: https://recharts.org
