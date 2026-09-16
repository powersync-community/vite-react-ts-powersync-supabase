# Reproducing the OPFSWriteAheadVFS disk I/O error

Several tabs share one OPFS database. Reload them while a large sync is still
running and one tab's position in the WAL is left permanently wrong. From then
on it reads null transactions, and writes fail with `disk I/O error` or
`database disk image is malformed`.

Upstream issue: [rhashimoto/wa-sqlite#345](https://github.com/rhashimoto/wa-sqlite/issues/345).
Mechanism: [docs/vfs-bug-and-fix.md](docs/vfs-bug-and-fix.md).

## Run it

```bash
pnpm install
pnpm exec playwright install chromium

pnpm dev      # terminal 1
pnpm repro    # terminal 2
```

Typical output:

```
opening 4 tabs on http://localhost:5173
round 1: reloaded tab 1  downloaded=5%
round 2: reloaded tab 2  downloaded=10%
round 3: reloaded tab 3  downloaded=69%
round 4: reloaded tab 4  downloaded=72%
...
  >> tab 1: invalid WAL file
     invalid WAL file

  >> tab 2: null transaction
     Cannot read properties of null (reading 'id')

  >> tab 3: disk I/O error
     [PowerSync]: Sync error Error: disk I/O error

round 12: watching the broken tab  downloaded=80%
...
REPRODUCED at round 11
  invalid WAL file: 4
  null transaction: 583
  disk I/O error: 4
```

Exit code 2 means it reproduced. It is a race: five runs in a row reproduced,
breaking at rounds 3, 4, 5, 6 and 11, so give it the full 30 rounds and run it
again if one happens to miss.

`HEADED=1 pnpm repro` shows the tabs so you can watch it happen. Other knobs:
`TABS=4 ROUNDS=30 APP=http://localhost:5173`. Timings are constants at the top
of the script.

## What the script does

Four tabs on one OPFS database, then every four seconds:

1. **Reload one tab.** Real reloads, the same as pressing Cmd-R. The other
   three keep syncing, so the database keeps being written to while one tab
   rejoins.
2. **Write to a local-only table.** A steady trickle of inserts into `churn`,
   which is marked `localOnly` so nothing is uploaded and no real data is
   touched. This stands in for an app that writes while it syncs. It matters
   because every write fills the active WAL file, and once full the VFS swaps
   to the other file and checkpoints. That rotation is the race: a tab that
   rejoins a moment late is told about a transaction whose WAL file has already
   been checkpointed and truncated away.

Once a tab breaks, the script stops reloading and keeps watching it. A reload
would give that tab a fresh WriteAhead instance and hide the damage; leaving it
alone shows what a user actually experiences, which is every later transaction
failing.

Nothing is posted to the VFS's BroadcastChannel, no transaction ids are forged,
and no SDK internals are touched.

## Data

The app syncs the `counters` table from the cloud Supabase project in
`.env.local`, about 100,000 rows and 313,000 sync operations. Each run uses a
fresh browser context, so OPFS starts empty and every run performs a full
initial sync. That download is what keeps the writer busy at the start.

## Versions

| Package | Version |
|---|---|
| `@powersync/web` | 2.3.1 |
| `@powersync/common` | 2.2.1 |
| `@journeyapps/wa-sqlite` | 2.0.4 |

The SDK is unpatched. This repo previously carried
`patches/@powersync__web.patch`, an `if (!tx) break` guard against this same
bug. It was removed because it does not fix it: it hides the crash and leaves
the tab reading null forever. See the note at the top of
[docs/vfs-bug-and-fix.md](docs/vfs-bug-and-fix.md).
