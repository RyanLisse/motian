# Pipeline

Pipeline shows applications on a kanban or in a list so a recruiter can see stages (`Nieuw`, `Screening`, `Interview`, `Aanbod`, `Geplaatst`, `Afgewezen`).

## Sub-features

- `pipeline-open` renders heading `Pipeline` and KPI `Totaal`.
- `pipeline-kanban` is the default (`weergave` omitted or `kanban`) with stage columns.
- `pipeline-list` switches via the `Lijst` link to `?weergave=lijst`.
- `pipeline-empty` shows `Geen sollicitaties gevonden` when the filtered set is empty.

## How to get to it (user POV)

- Choose `Pipeline` in the Werving sidebar.
- Open `/pipeline`.
- Choose `Kanban` or `Lijst` in the header toggle.
- Optionally filter with `?fase=` or `?vacature=`.

## Driving it with capture.mjs

Preconditions:

- `bin/doctor.sh` is OK.
- Do not drag cards. Dragging persists stage changes on the shared database.

- **Open kanban.** Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /pipeline --name pipeline-kanban --expect-text "Pipeline"`. `body.txt` contains `Kanban`, `Lijst`, and at least one of `Nieuw`, `Screening`, `Totaal`.
- **Switch to list.** Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /pipeline?weergave=lijst --name pipeline-lijst --expect-text "Pipeline"`. The list view is active; empty state text is `Geen sollicitaties gevonden` when there are no rows.
- **Proof.** Keep both PNGs. They must show the Pipeline heading and the view toggle, not a 429.

## Gotchas

- `/pipeline` is rate-limited in `proxy.ts` (10 requests / 10s / IP, bots like `curl/` get 429). Use a real browser UA for repeated hits; space out reloads.
- Default view is kanban. Assert `weergave=lijst` only after opening that URL or clicking `Lijst`.
- An empty pipeline is a valid pass if the empty state renders. Do not create applications to fill the board.
