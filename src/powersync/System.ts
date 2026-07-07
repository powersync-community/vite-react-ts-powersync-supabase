import {
  createBaseLogger,
  LogLevel,
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
} from "@powersync/web";
import { AppSchema } from "./AppSchema";
import { connector } from "./SupabaseConnector";

const logger = createBaseLogger();
logger.useDefaults();
logger.setLevel(LogLevel.DEBUG);

/**
 * Detects OPFS availibility
 *
 * OPFS requires navig
 */
export function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof Worker === "function"
  );
}

/**
 * Detects mobile devices (phones and tablets).
 *
 * Prefers the modern `navigator.userAgentData.mobile` hint (Chromium) and
 * falls back to user-agent sniffing, which is required because Safari does not
 * implement `userAgentData`. Note that iPadOS 13+ reports a desktop Mac
 * user-agent, so it is detected via touch-point support instead.
 */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (typeof uaData?.mobile === "boolean") return uaData.mobile;

  const ua = navigator.userAgent;
  // iPadOS 13+ masquerades as macOS; a Mac reporting touch points is really an iPad.
  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return /Android|iPhone|iPad|iPod|Mobi/i.test(ua) || isIPadOS;
}

/**
 * Detects Apple's Safari / WebKit.
 *
 * Every browser on iOS/iPadOS (including Chrome and Firefox) is WebKit under
 * the hood and shares Safari's OPFS limitations, so iOS is always treated as
 * Safari. On desktop we match Safari but exclude Chromium- and Firefox-based
 * browsers, which also carry "Safari" in their user-agent string.
 */
export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return true;

  return (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS|CriOS/i.test(ua)
  );
}

/**
 * Probes whether OPFS can actually be used, not just whether the API exists.
 *
 * Safari (including Safari Private Browsing) exposes the OPFS API surface even
 * when it is non-functional, so the synchronous `isOPFSAvailable` check isn't
 * enough. We confirm real usability by opening a SyncAccessHandle inside a
 * throwaway Worker, which is exactly what OPFSCoopSyncVFS relies on and which
 * fails in Safari Private Browsing. Non-Safari browsers that expose the API
 * support it, so we skip the (more expensive) probe there.
 */
export async function isOPFSUsable(): Promise<boolean> {
  if (!isOPFSAvailable()) return false;
  if (!isSafari()) return true;

  const workerSource = `
    self.onmessage = async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const file = await root.getFileHandle("__powersync_opfs_probe__", { create: true });
        const handle = await file.createSyncAccessHandle();
        handle.close();
        await root.removeEntry("__powersync_opfs_probe__");
        self.postMessage(true);
      } catch {
        self.postMessage(false);
      }
    };
  `;

  let url: string | undefined;
  try {
    url = URL.createObjectURL(
      new Blob([workerSource], { type: "text/javascript" }),
    );
    const worker = new Worker(url);
    const usable = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000);
      worker.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data === true);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      worker.postMessage(null);
    });
    worker.terminate();
    return usable;
  } catch {
    // If we can't even spawn the probe, assume OPFS is unusable and fall back.
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * Recognises Safari Private Browsing: desktop Safari where OPFS is present but
 * not usable. Multi-tab is disabled there because a private tab cannot reliably
 * run a SharedWorker + OPFS, and private tabs are isolated from each other anyway.
 */
export function isSafariPrivate(opfsUsable: boolean): boolean {
  return isSafari() && !isMobile() && !opfsUsable;
}

export function pickVFS(opfsUsable: boolean = isOPFSAvailable()): WASQLiteVFS {
  const safari = isSafari();
  const mobile = isMobile();
  const multiTab = typeof SharedWorker !== "undefined";

  // Fall back to IndexedDB (IDBBatchAtomicVFS) when OPFS can't be used:
  //  - OPFS is not usable at all: no API, or Safari Private Browsing where the
  //    API exists but createSyncAccessHandle fails (see isOPFSUsable), or
  //  - mobile Safari (iOS/iPadOS), where OPFS is not supported, or
  //  - desktop Safari with multi-tab, which cannot coordinate OPFS across tabs.
  const forceIndexedDB = !opfsUsable || (safari && (mobile || multiTab));

  const vfs = forceIndexedDB
    ? WASQLiteVFS.IDBBatchAtomicVFS
    : WASQLiteVFS.OPFSCoopSyncVFS;

  console.log(
    `[powersync] using VFS: ${vfs} (safari=${safari}, mobile=${mobile}, multiTab=${multiTab}, opfsUsable=${opfsUsable})`,
  );
  return vfs;
}

/**
 * Default configuration AccessHandlePoolVFS - uses IndexedDB
 * ✅ Use this for: Simple setup, most browsers
 * ❌ Avoid if: You need Safari support or have stability issues
 */
// export const powerSync = new PowerSyncDatabase({
//   schema: AppSchema,
//   database: {
//     dbFilename: 'example.db'
//   },
//   logger: logger
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
// Resolve the storage strategy once before opening the database. The OPFS
// usability probe is async (it spins up a Worker), hence the top-level await.
const opfsUsable = await isOPFSUsable();
const enableMultiTabs =
  typeof SharedWorker !== "undefined" && !isSafariPrivate(opfsUsable);

export const powerSync = new PowerSyncDatabase({
  database: new WASQLiteOpenFactory({
    dbFilename: "exampleVFS.db",
    vfs: pickVFS(opfsUsable),
    flags: {
      enableMultiTabs,
    },
  }),
  flags: {
    enableMultiTabs,
  },
  schema: AppSchema,
  logger: logger,
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
powerSync.connect(connector, {
  crudUploadThrottleMs: 5000,
});
