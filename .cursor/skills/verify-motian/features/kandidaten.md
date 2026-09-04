# Kandidaten

Kandidaten is the talent pool. A recruiter searches by name, filters availability, and opens a profile.

## Sub-features

- `kandidaten-open` renders heading `Kandidaten` with KPI labels `Totaal`, `Direct beschikbaar`, `Nieuw deze week`.
- `kandidaten-search` submits `q` via the `Zoeken` button and updates `N kandidaten gevonden`.
- `kandidaten-open-profile` opens `/kandidaten/<id>` from a result card.
- `kandidaten-empty` shows `Geen kandidaten gevonden` for a name that does not exist.

## How to get to it (user POV)

- Choose `Kandidaten` in the Werving sidebar.
- Open `/kandidaten`.
- Submit the form (`Zoek op naam...` + `Zoeken`).
- Open a card to `/kandidaten/<id>`.
- Use `Kandidaat toevoegen` only when writes are authorized (not in the default proof).

## Driving it with capture.mjs

Preconditions:

- `bin/doctor.sh` is OK.
- Read-only. Do not complete the add-candidate wizard.

- **Open list.** Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /kandidaten --name kandidaten-list --expect-text "Kandidaten"`. `body.txt` contains `Zoek op naam...`, `Zoeken`, and either `kandidaten gevonden` or `Geen kandidaten gevonden`.
- **Search existing.** If the unfiltered list shows a name, search a distinctive fragment of that name: `--path /kandidaten --name kandidaten-search --fill-selector 'input[name="q"]' --fill-value "<fragment>" --click-selector 'button[type="submit"]' --wait-ms 1500 --expect-text "gevonden"`. The count line updates and the fragment appears in a card.
- **Empty search.** `--path /kandidaten --name kandidaten-empty --fill-selector 'input[name="q"]' --fill-value "zzzx-no-such-kandidaat" --click-selector 'button[type="submit"]' --wait-ms 1500 --expect-text "Geen kandidaten gevonden"`.
- **Open profile.** Click a result card (`a[href^="/kandidaten/"]` that is not the list itself). Capture `/kandidaten/<id>` and expect the candidate name from the card.
- **Proof.** Keep list + search or empty PNG/body dumps. The empty-search proof is valid even when the pool is empty.

## Gotchas

- Search is a document GET, not live-filter. Click `Zoeken` (or submit the form) and wait until the URL contains `?q=`. Capture's `--click-selector 'button[type="submit"]'` is the production control. A focused button without a URL change is not a submit.
- `Kandidaat toevoegen` writes to Neon. Leave it closed.
- The skills dropdown can be disabled (`Vaardigheden-filter tijdelijk niet beschikbaar`). That is not a list failure.
- Soft-deleted candidates stay hidden. A search miss is not proof the row is gone from the database.
