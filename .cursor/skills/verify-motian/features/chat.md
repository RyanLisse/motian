# Chat

Chat is the full-page Motian AI assistant. A recruiter types in `Bericht aan Motian AI`, can upload a CV, and may start voice. Sending a message writes a chat session and spends OpenRouter.

## Sub-features

- `chat-open` shows heading `Motian AI` and empty state `Waar wil je vandaag op sturen?`.
- `chat-composer` exposes textbox `Bericht aan Motian AI` and hint `Enter om te verzenden`.
- `chat-context` (optional) opens from a vacature or kandidaat with a context badge — only after those details exist.

## How to get to it (user POV)

- Choose `Chat` in the Werving sidebar.
- Open `/chat`.
- Open chat from a vacature/kandidaat context (composer placeholder changes).

## Driving it with capture.mjs

Preconditions:

- `bin/doctor.sh` is OK.
- **Do not send.** Sending is a write + paid AI call. Default proof stops at the empty composer.

- **Open chat.** Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /chat --name chat-open --expect-text "Motian AI"`. `body.txt` contains `Waar wil je vandaag op sturen?` and `Bericht aan Motian AI` (or the composer placeholder `Vraag om vacatures, kandidaten, analyses of hulp bij een CV-upload`).
- **Composer idle.** Confirm no in-flight assistant message and the send control is present. Do not press Enter.
- **Proof.** PNG + `body.txt` showing Motian AI chrome and the empty state. That is a complete default pass.

## Gotchas

- Widget chat (`Motian AI chatwidget`) can appear on other pages. Full-page proof is `/chat` only; do not count the widget as this feature.
- Missing `OPENROUTER_API_KEY` fails only if you send. Do not send, then do not file that skip as a composer failure.
- Chat sessions persist in Neon. A send you were not asked to make is leftover state — do not clean other people's sessions.
