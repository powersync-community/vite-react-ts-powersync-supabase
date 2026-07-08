import {
  createBaseLogger,
  LogLevel,
  PowerSyncDatabase,
  WASQLiteOpenFactory,
} from "@powersync/web";
import { AppSchema } from "./AppSchema";
import { connector } from "./SupabaseConnector";

const logger = createBaseLogger();
logger.useDefaults();
logger.setLevel(LogLevel.DEBUG);

/**
 * Default configuration - uses IndexedDB storage
 * ✅ Use this for: Simple setup, most browsers
 * ❌ Avoid if: You need Safari support or have stability issues
 */
// export const powerSync = new PowerSyncDatabase({
//   schema: AppSchema,
//   database: {
//     dbFilename: "example.db",
//   },
//   logger: logger,
// });

/**
 * Alternative configuration with OPFS storage (Origin Private File System)
 *
 * 🚀 RECOMMENDED: Use OPFSCoopSyncVFS for production apps
 *
 * ✅ When to use:
 * - You need multi-tab support across ALL browsers (including Safari)
 * - Better performance than IndexedDB
 * - Safari/iOS compatibility is important
 *
 * ❌ When NOT to use:
 * - Safari incognito mode (known issues)
 * - You prefer simpler setup
 *
 * Alternative: Change to WASQLiteVFS.AccessHandlePoolVFS for single-tab apps with best performance
 *
 * 📚 Learn more: https://docs.powersync.com/client-sdk-references/javascript-web#sqlite-virtual-file-systems
 */
// export const powerSync = new PowerSyncDatabase({
//   database: new WASQLiteOpenFactory({
//     dbFilename: "exampleVFS.db",
//     vfs: WASQLiteVFS.OPFSCoopSyncVFS, // Use AccessHandlePoolVFS for single-tab only
//     flags: {
//       enableMultiTabs: typeof SharedWorker !== "undefined",
//     },
//   }),
//   flags: {
//     enableMultiTabs: typeof SharedWorker !== "undefined",
//   },
//   schema: AppSchema,
//   logger: logger,
// });

/**
 * TODO document in-memory usage.
 */
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: new WASQLiteOpenFactory({
    // Ensure each tab has a unique database to avoid sync clients trying to acquire the same lock.
    dbFilename: `example-${crypto.randomUUID()}.db`,
    flags: {
      enableMultiTabs: false,
      useWebWorker: false, // Enabling this should also work, takes load off the main tab but is slower.
    },
  }),
  logger: logger,
  flags: {
    enableMultiTabs: false,
  },
});

/**
 * Quick Decision Guide:
 *
 * 🎯 Most apps → Use OPFSCoopSyncVFS (uncomment above)
 * 📱 Safari users → Must use OPFSCoopSyncVFS
 * ⚡ Single tab only → Use AccessHandlePoolVFS
 * 🔧 Quick prototype → Keep default (IndexedDB)
 */

// Sign in the user anonymously to Supabase (creates a temporary user session)
await connector.signInAnonymously();

// Establish connection between PowerSync and the Supabase connector
powerSync.connect(connector);
