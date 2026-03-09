# Motian Docs Site

Standalone Fumadocs / Next.js documentation app.

## Install

- From the repo root: `pnpm install`
- Or from this directory: `pnpm install --frozen-lockfile`

This folder keeps its own `pnpm-lock.yaml`, so standalone installs remain pinned.

## Commands

- `just docs` (from repo root) — start the docs dev server on port 4000
- `pnpm dev` — start the docs dev server from this directory
- `pnpm build` — create a production build
- `pnpm types:check` — regenerate MDX types and run `tsc --noEmit`

## Notes

- `pnpm build` and `pnpm types:check` require installed local dependencies.
- `fumadocs-mdx` is used in both `postinstall` and `types:check`, so a missing binary almost always means this subproject has not been installed yet.

## Troubleshooting

- `Cannot find package 'fumadocs-mdx'` or `fumadocs-mdx: command not found` means `node_modules` is missing in `fumadocs/`.
- If you are bootstrapping from the repo root, rerun `pnpm install` after confirming `fumadocs/` is included in `pnpm-workspace.yaml`.