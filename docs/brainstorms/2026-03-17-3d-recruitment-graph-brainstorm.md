# Brainstorm: 3D Recruitment Graph Visualization

**Date:** 2026-03-17  
**Author:** AI Architect  
**Status:** Draft

## What We're Building

A comprehensive 3D interactive graph visualization of the Motian recruitment platform's data relationships, accessible via both a dedicated page and contextual modals. The visualization will help recruiters gain insights into talent pools, job-candidate matching, skills taxonomy, and pipeline health.

## Why This Approach

The user wants a comprehensive recruitment graph showing all key entities and their relationships with match quality as the primary insight. Using `react-force-graph-3d` provides a proven, performant solution for 500+ nodes with WebGL rendering.

## Data Model

### Nodes
- **Jobs** - Vacatures with title, company, location, rate, skills
- **Candidates** - Kandidaten with skills, experience, availability
- **ESCO Skills** - Hierarchical skill taxonomy (~30k skills)
- **Applications** - Job applications with stage
- **Interviews** - Scheduled interviews

### Edges
- Job → Candidate (matches with score)
- Candidate → Skill (has skill)
- Job → Skill (requires skill)
- Skill → Skill (broaderUri hierarchy)
- Candidate → Application (has applied)
- Application → Interview (has scheduled)

## Key Visual Design Decisions

### Node Types & Colors
| Entity | Color | Shape | Size |
|--------|-------|-------|------|
| Jobs | Blue (#3B82F6) | Sphere | Based on match count |
| Candidates | Green (#10B981) | Sphere | Based on skill count |
| ESCO Skills | Purple (#8B5CF6) | Sphere | Based on demand |
| Applications | Orange (#F59E0B) | Sphere | Based on stage |
| Interviews | Red (#EF4444) | Sphere | Based on status |

### Edge Types & Colors
| Relationship | Color | Opacity |
|--------------|-------|---------|
| Strong Match (80%+) | Green | 0.8 |
| Medium Match (50-79%) | Yellow | 0.5 |
| Weak Match (<50%) | Red | 0.3 |
| Skill Hierarchy | Gray | 0.4 |
| Application Flow | White | 0.6 |

### Match Quality Visualization
- Node size reflects match score
- Edge thickness indicates match strength
- Color coding for match quality (green/yellow/red)
- Tooltip shows match reasoning and criteria breakdown

## Interaction Requirements

### Navigation
- Rotate: Click and drag
- Zoom: Scroll wheel
- Pan: Right-click drag
- Auto-rotate: Toggle option

### Selection
- Click node: Show detail panel
- Multi-select: Ctrl+click
- Filter panel: Sidebar with entity toggles
- Search: Highlight and focus specific nodes

### Contextual Views
- From Vacatures page: Modal showing candidates for selected job
- From Kandidaten page: Modal showing matching jobs
- From Pipeline: Modal showing conversion flow

## Implementation Approach

### Tech Stack
- **react-force-graph-3d** - 3D graph rendering with WebGL
- **Three.js** - Underlying 3D engine
- **Zustand** - State management for filters and selection

### API Endpoints Needed
- `GET /api/visualisatie/graph` - Returns all nodes/edges for full graph
- `GET /api/visualisatie/job/[id]/matches` - Returns candidates for specific job
- `GET /api/visualisatie/candidate/[id]/matches` - Returns jobs for specific candidate

### Page Routes
- `/visualisatie` - Full graph overview
- Modals on: `/vacatures/[id]`, `/kandidaten/[id]`, `/sollicitaties`

## Resolved Questions

1. **Performance limit**: Start with top 100 matches, lazy load more on zoom/filter
2. **Skill hierarchy**: Collapsed by default, show top-level categories, expand on click
3. **Real-time updates**: SSE (Server-Sent Events) for live updates

## Key Decisions

- Use `react-force-graph-3d` for proven WebGL performance
- Access via both dedicated page (`/visualisatie`) and contextual modals
- Color-coded match quality with visual scoring and reasoning
- Node sizes based on match count/skill count/demand

## Next Steps

Proceed to `/ce:plan` for implementation details.
