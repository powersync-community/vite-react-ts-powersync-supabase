import {
  createConsoleLogger,
  LogLevels,
  PowerSyncDatabase,
  WASQLiteVFS,
} from "@powersync/web";
import { AppSchema } from "./AppSchema";

export const DB_FILENAME = "repro.db";

// OPFSWriteAheadVFS is the VFS under test. It is the only one that supports
// additional read-only connections, so each tab runs three database workers
// (one writer, two readers) against the same OPFS files, coordinating over
// Web Locks and a BroadcastChannel.
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: DB_FILENAME,
    vfs: WASQLiteVFS.OPFSWriteAheadVFS,
    additionalReaders: 2,
  },
  logger: createConsoleLogger({ minLevel: LogLevels.warn }),
});

// The repro script reads sync status through this handle.
(globalThis as Record<string, unknown>).powerSync = powerSync;
