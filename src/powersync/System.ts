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
  // iPadOS 13+ looks like macOS; a Mac reporting touch points is really an iPad.
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
 * Detects OPFS availibility
 *
 * Checking if the OPFS related functions are availible
 */
export function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof Worker === "function"
  );
}

/**
 * Checks whether OPFS actually works, not just whether the API exists.
 *
 * Safari Private Browsing exposes the OPFS API but rejects when you request the
 * directory, so calling getDirectory() distinguishes a usable OPFS from an
 * unusable one. Browsers that expose the API otherwise support it.
 */
export async function isOPFSUsable(): Promise<boolean> {
  if (!isOPFSAvailable()) return false;
  try {
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

export function pickVFS(opfsUsable: boolean = isOPFSAvailable()): WASQLiteVFS {
  const safari = isSafari();
  const mobile = isMobile();
  const multiTab = typeof SharedWorker !== "undefined";

  // Fall back to IndexedDB (IDBBatchAtomicVFS) when OPFS can't be used:
  //  - OPFS is not usable at all: no API, or Safari Private Browsing where the
  //    API exists but createSyncAccessHandle fails (see isOPFSUsable), or
  //  - mobile Safari (iOS/iPadOS), where OPFS is not supported, or
  //  - desktop Safari with multi-tab, due to aggressive tab suspension from Safari
  const forceIndexedDB = !opfsUsable || (safari && (mobile || multiTab));

  const vfs = forceIndexedDB
    ? WASQLiteVFS.IDBBatchAtomicVFS
    : WASQLiteVFS.OPFSCoopSyncVFS;

  console.log(
    `[powersync] using VFS: ${vfs} (safari=${safari}, mobile=${mobile}, multiTab=${multiTab}, opfsUsable=${opfsUsable})`,
  );
  return vfs;
}

const opfsUsable = await isOPFSUsable();
const enableMultiTabs = typeof SharedWorker !== "undefined";

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

// Sign in the user anonymously to Supabase (creates a temporary user session)
await connector.signInAnonymously();

// Establish connection between PowerSync and the Supabase connector
powerSync.connect(connector, {
  crudUploadThrottleMs: 5000,
});
