# Motian Voice Agent

Standalone LiveKit voice agent for Motian.

## Install

- From the repo root: `pnpm install`
- Or from this directory: `pnpm install --frozen-lockfile`

This folder has its own `pnpm-lock.yaml`, so it can be installed independently.

## Commands

- `pnpm build` — bundle the agent with Vite
- `pnpm dev` — build and run in development mode
- `pnpm start` — run the built bundle
- `pnpm download-files` — build and run the download command

## Requirements

- Node 22+ (`vite.config.ts` targets `node22`)
- pnpm 9.15.0

Runtime credentials are still required to start the agent successfully (for example LiveKit and Google AI settings consumed via `dotenv`).

## Troubleshooting

- `vite: command not found` means this subproject has not been installed yet.
- If you are working from the repo root, make sure `agent/` is included in `pnpm-workspace.yaml` and rerun `pnpm install`.