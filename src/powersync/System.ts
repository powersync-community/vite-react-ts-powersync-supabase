import {
  createConsoleLogger,
  LogLevels,
  PowerSyncDatabase,
  WASQLiteVFS,
} from "@powersync/web";
import { AppSchema } from "./AppSchema";
import { connector } from "./SupabaseConnector";

const logger = createConsoleLogger({ minLevel: LogLevels.debug });

/**
 * Checks whether OPFS actually works, not just whether the API exists.
 *
 * Safari Private Browsing exposes the OPFS API but rejects when you request the
 * directory, so calling getDirectory() distinguishes a usable OPFS from an
 * unusable one. Browsers that expose the API otherwise support it.
 */
export async function isOPFSUsable(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.storage?.getDirectory !== "function" ||
    typeof Worker !== "function"
  ) {
    return false;
  }
  try {
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

// OPFSCoopSyncVFS is the recommended VFS and is stable across browsers,
// including Safari. Fall back to IndexedDB when OPFS can't be used at all
// (no API, or Safari Private Browsing). Multi-tab support is managed by the
// SDK itself: enabled by default on desktop browsers, disabled on Safari.
const opfsUsable = await isOPFSUsable();
const vfs = opfsUsable
  ? WASQLiteVFS.OPFSCoopSyncVFS
  : WASQLiteVFS.IDBBatchAtomicVFS;

console.log(`[powersync] using VFS: ${vfs} (opfsUsable=${opfsUsable})`);

export const powerSync = new PowerSyncDatabase({
  database: {
    dbFilename: "exampleVFS.db",
    vfs,
  },
  schema: AppSchema,
  logger,
});

// Sign in the user anonymously to Supabase (creates a temporary user session)
await connector.signInAnonymously();

// Establish connection between PowerSync and the Supabase connector.
// checkpointMode 'requests' enables powerSync.requestCheckpoint(), used by the
// refresh flow in App.tsx (requires PowerSync Service 1.24.0+).
powerSync.connect(connector, {
  crudUploadThrottleMs: 5000,
  checkpointMode: "requests",
});
