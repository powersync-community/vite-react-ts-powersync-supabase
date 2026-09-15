# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Template for offline-first web apps: Vite + React 19 + TypeScript on the client, PowerSync v2 SDK (`@powersync/web` 2.x) for client-side SQLite sync, Supabase for the Postgres backend and auth. The demo is a counter app where each anonymous user creates one counter and all counters sync to everyone.

A PowerSync agent skill is installed at `.agents/skills/powersync` (symlinked into `.claude/skills/`, tracked by `skills-lock.json`). Load it before data, schema, sync, or auth changes.

## Commands

```bash
pnpm dev:supabase    # Start local Supabase stack (requires Docker + Supabase CLI). Run FIRST.
pnpm dev:powersync   # Start self-hosted PowerSync service (docker/compose.yaml)
pnpm dev:ui          # Vite dev server at http://localhost:5173
pnpm build           # tsc -b && vite build
pnpm lint            # eslint .
pnpm type-check      # tsc --noEmit
```

- pnpm only (pinned via `packageManager` in package.json); CI uses `pnpm install --frozen-lockfile`. There is no npm lockfile.
- `dev:supabase` must run before `dev:powersync`: the PowerSync container joins the external Docker network `supabase_network_powersync`, which the Supabase CLI creates.
- Local env setup: `cp .env.local.template .env.local` (works as-is with the local Docker stack). For hosted PowerSync + Supabase, use `.env.cloud.template` instead and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_POWERSYNC_URL`.
- There is no test suite. CI (`.github/workflows/ci.yml`) runs lint, type-check, and build.
- `pnpm-workspace.yaml` must list packages with postinstall builds under `allowBuilds` (`@journeyapps/wa-sqlite`, `esbuild`, `supabase`) or their native/WASM setup silently doesn't run.

## Architecture

Data flow: components write to local SQLite via `powerSync.execute()`; PowerSync queues the CRUD and `SupabaseConnector.uploadData()` pushes it to Postgres through supabase-js. Postgres changes replicate back through the PowerSync service (logical replication via the `powersync` publication) into the local database, and `useQuery` watch queries re-render automatically. The app reads and writes only the local database; it never queries Supabase directly for data.

All PowerSync wiring lives in `src/powersync/`:

- **`System.ts`** — composition root, uses top-level await. Creates the `PowerSyncDatabase` (v2 style: `database: { dbFilename, vfs }` — no open factory, no `flags`), signs in anonymously to Supabase, and connects with `checkpointMode: "requests"`. VFS selection: `OPFSCoopSyncVFS` when the async `isOPFSUsable()` probe passes, `IDBBatchAtomicVFS` otherwise. The probe is a runtime check, not a feature check — Safari Private Browsing exposes the OPFS API but `getDirectory()` rejects. Multi-tab is left to SDK defaults (v2 enables it on desktop and disables it on Safari automatically); do not reintroduce hand-rolled browser detection.
- **`SupabaseConnector.ts`** — implements `PowerSyncBackendConnector` (v2: the database parameter is the `CommonPowerSyncDatabase` interface, imported with `import type`). `fetchCredentials()` returns the Supabase access token plus an `expiresAt` hint; `uploadData()` replays queued ops (PUT → upsert, PATCH → update, DELETE → delete). Fatal Postgres error codes (classes 22 and 23, plus 42501) discard the transaction so it doesn't block the upload queue; other errors are rethrown so PowerSync retries.
- **`AppSchema.ts`** — client-side schema (the `counters` table) and derived TypeScript types (`Database`, `CounterRecord`).
- **`SystemProvider.tsx` / `SystemContext.tsx`** — expose `powerSync` and the connector via React context; components consume them with `useQuery`/`useStatus` from `@powersync/react`.

Checkpoint requests (alpha API, `@powersync/web` ≥ 2.3.0, PowerSync Service ≥ 1.24.0): `App.tsx` has a Refresh button that calls `powerSync.requestCheckpoint()` then `checkpoint.waitForSync({ signal })`. This requires the `checkpointMode: "requests"` connect option set in `System.ts`. No manual re-query afterwards — watch queries pick up the synced data.

### Sync configuration (Sync Streams, edition 3) lives in two places

- **`docker/powersync.yaml`** — self-hosted service config used by the local Docker stack; the `sync_config` block holds the streams. Also configures Supabase JWT validation both ways: legacy HS256 shared secret (`PS_SUPABASE_JWT_SECRET`) and ES256 signing keys via the JWKS endpoint (`PS_SUPABASE_JWKS_URI`).
- **`sync-config.yaml`** — the same streams for PowerSync Cloud instances, deployed via the dashboard editor or the PowerSync CLI (`powersync deploy sync-config`). Must keep the top-level `config: edition: 3` wrapper.

A schema or sync change typically touches four places: the Postgres schema (`supabase/migrations/` for local, `database.pgsql` for manual cloud setup), `AppSchema.ts`, and both sync configuration files above.

## Constraints

- `vite.config.ts` excludes `@journeyapps/wa-sqlite` and `@powersync/web` from `optimizeDeps` and sets `worker.format: 'es'` with the wasm plugin — required because those packages ship web workers and WASM. Don't remove these. `@journeyapps/wa-sqlite` is a transitive dependency of `@powersync/web` (not a direct dependency); the exclude entry still applies to it.
- Do NOT add `vite-plugin-top-level-await`: its SWC pass breaks on the v2 worker bundle with Vite 7/Rollup 4, and Vite 7's default build target supports top-level await natively (`src/powersync/System.ts` relies on it).
- ESLint ignores `.agents/` (installed skill scripts, not app code) — keep that entry in `eslint.config.js`.
- Auth is anonymous Supabase sign-in (demo-specific); the `counters` table has no RLS and the global stream syncs every counter to every user.
