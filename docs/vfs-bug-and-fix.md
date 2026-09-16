# The sync-freeze bug

> Corrected 2026-09-16. An earlier version of this file said the cause was a
> commit broadcast before its WAL write was flushed, and recommended a
> `if (!tx) break` guard shipped as `patches/@powersync__web.patch`. Both were
> wrong. The guard was measured against a reproduction 3 times out of 3 and
> never fixed anything: it removes the crash and leaves the tab reading null
> forever instead, firing 4,726 times in one run. The patch has been removed
> from this repo.

## The symptom

Apps on the OPFS write-ahead VFS stop syncing but still look connected. The
console shows `Cannot read properties of null (reading 'id')` and then
`disk I/O error` on every write. Reads keep working, so nothing looks wrong
until someone notices `lastSyncedAt` is days old.

## The cause

Several workers share one SQLite database and announce new transactions to each
other over a BroadcastChannel. Transactions are numbered by position in the log
file, so each worker applies them strictly in order.

The VFS keeps two WAL files and alternates between them. A checkpoint copies
the active one into the database file and truncates the other. Under a large
sync the writer rotates and checkpoints about every 1.5 seconds.

A tab that just reloaded, or was briefly busy, picks up an announcement one
generation late. The transaction it names has already been checkpointed into
the database file and its log truncated to zero bytes. It is durable, and it is
no longer in any log. `#followFileChange` only accepts the *next* generation
(`salt1 + 1`), so following back to it fails and `#skipTx` throws
`invalid WAL file`.

That alone would be survivable. What makes it permanent is the order of two
lines in `#advanceTxId`: the transaction is deleted from `#mapIdToPendingTx`
*before* `#skipTx` is called, and the line that advances `#txId` sits after the
throw. So the id is lost and the counter never moves. Every later announcement
is then out of sequence, falls through to `#readTx()`, gets null, and
dereferences it. Thrown inside `jUnlock`, SQLite receives
`SQLITE_IOERR_UNLOCK` and reports `disk I/O error`. The disk is fine.

## Why guarding it does not work

The log will never produce that transaction again, so anything that waits or
retries leaves the tab wedged. A fix has to advance `#txId` past the gap while
proving the pages it drops were genuinely checkpointed. That is a change to the
WAL recovery contract rather than a guard, so it belongs upstream in
[rhashimoto/wa-sqlite#345](https://github.com/rhashimoto/wa-sqlite/issues/345).

A variant that resynced from disk without that proof removed the error chain and
corrupted the database instead: 220 `database disk image is malformed` events in
one run of three.

## Reproduce it

See the README. `pnpm repro` drives real tabs and real reloads; nothing is
injected into the BroadcastChannel.
