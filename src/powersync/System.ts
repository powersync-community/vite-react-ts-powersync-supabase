import {
  createBaseLogger,
  LogLevel,
  PowerSyncDatabase,
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
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'example.db'
  },
  logger: logger
});

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
 * Quick Decision Guide:
 * 
 * 🎯 Most apps → Use OPFSCoopSyncVFS (uncomment above)
 * 📱 Safari users → Must use OPFSCoopSyncVFS 
 * ⚡ Single tab only → Use AccessHandlePoolVFS
 * 🔧 Quick prototype → Keep default (IndexedDB)
 */

powerSync.connect(connector);
