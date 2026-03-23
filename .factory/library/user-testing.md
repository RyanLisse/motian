# User Testing

## Validation Surface

- **Primary surface**: Browser (localhost:3002)
- **Tool**: agent-browser
- **Setup**: Start dev server with `pnpm dev` (port 3002), navigate to pages
- **Auth**: No auth required for local development

### Testable Pages
- `/visualisatie` — Full 3D graph visualization page
- `/vacatures/[id]` — Vacature detail with graph modal trigger
- `/kandidaten/[id]` — Kandidaat detail with graph modal trigger

### Known Limitations
- WebGL/3D rendering requires a real browser — cannot test via curl
- 3D graph interactions (rotate, zoom) require mouse events
- SSE testing requires keeping a connection open while triggering changes

## Validation Concurrency

- **Machine**: 32 GB RAM, 10 CPU cores
- **Dev server**: ~200 MB RAM
- **agent-browser**: ~300 MB per instance
- **Max concurrent validators**: 5
- **Rationale**: 5 instances = 1.5 GB + 200 MB dev server = 1.7 GB total, well within 70% of ~12 GB available headroom
