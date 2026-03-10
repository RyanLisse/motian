# Motian LinkedIn Importer Extension

Standalone browser extension built with WXT + React.

## Install

- From the repo root: `pnpm install`
- Or from this directory: `pnpm install`

Unlike `agent/` and `fumadocs/`, this folder does **not** keep its own lockfile.
The canonical pinned dependency set for the extension is the repo-root `pnpm-lock.yaml`.

## Commands

- `pnpm dev` — start Chromium dev mode
- `pnpm dev:firefox` — start Firefox dev mode
- `pnpm build` — create a production build
- `pnpm build:firefox` — create a Firefox build
- `pnpm compile` — run `tsc --noEmit`

## Generated files

`pnpm install` runs `wxt prepare` via `postinstall`, which generates `.wxt/tsconfig.json`.
That generated file is required for `pnpm compile` to succeed.

## Troubleshooting

- `wxt: command not found` means the extension dependencies have not been installed yet.
- `Cannot read file '.wxt/tsconfig.json'` means `wxt prepare` has not run yet; install dependencies first.
