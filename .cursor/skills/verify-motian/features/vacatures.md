# Vacatures

Vacatures lets a recruiter search the job list, refine with filters, and open a vacancy detail while the list stays available.

## Sub-features

- `vacatures-open` shows the empty-detail prompt `Start je zoektocht` and a populated or empty job list.
- `vacatures-search` filters the list from the `Zoek vacature` textbox (300ms debounce, no submit button).
- `vacatures-open-detail` opens `/vacatures/<id>` from a list row.
- `vacatures-search-api` returns the same query shape from `GET /api/vacatures/zoeken` (public GET).

## How to get to it (user POV)

- Choose `Vacatures` in the Werving sidebar.
- Open `/vacatures`.
- Open a row to `/vacatures/<id>`.
- Type into `Zoek vacature` on the vacatures layout.

## Driving it with capture.mjs

Preconditions:

- `bin/doctor.sh` is OK.
- Prefer a query that already exists in Neon (common Dutch role words such as `adviseur` or `developer`). If the list is empty, prove the empty UI and stop — do not scrape to create jobs.

- **Open list.** Choose Vacatures. Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /vacatures --name vacatures-list --expect-text "Start je zoektocht"`. `body.txt` contains `Zoek vacature`.
- **Search.** Fill the labeled textbox. Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /vacatures --name vacatures-search --fill-selector '[aria-label="Zoek vacature"]' --fill-value "adviseur" --wait-ms 1200 --expect-text "Zoek vacature"`. The list updates; `body.txt` should include `adviseur` in a title or show an empty list state, not a crash.
- **API cross-check.** `curl -fsS "$BASE_URL/api/vacatures/zoeken?q=adviseur&limit=5"` returns JSON with `jobs`, `total`, `page`. Save stdout under the same evidence folder as `zoeken.json`.
- **Open detail.** From the list, open the first job link (`/vacatures/<uuid>`). Run capture on that path with `--expect-text` set to the job title from the API. The detail heading matches that title.
- **Proof.** Keep list PNG (search box visible), search PNG or body dump after debounce, and `zoeken.json`. Record the job id opened.

## Gotchas

- Search is debounced 300ms and then fetches. Wait for the list or spinner to settle; do not assert immediately after fill.
- The main pane on `/vacatures` is the empty prompt until a row is selected. The jobs live in the list column, not that pane.
- `GET /api/vacatures/zoeken` is public; other vacature writes are not. Do not POST.
- Virtualized lists may not put every job in the accessibility tree. Scroll or use the first visible row.
- Do not start a scrape from Databronnen to populate an empty list.
