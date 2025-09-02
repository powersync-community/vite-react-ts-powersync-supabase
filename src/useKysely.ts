// app/hooks/useKysely.ts
import { wrapPowerSyncWithKysely } from "@powersync/kysely-driver";
import { useMemo } from "react";
import type { Database } from "./powersync/AppSchema";
import { powerSync } from "./powersync/System";

/**
 * Returns a Kysely-wrapped instance of the PowerSync database
 * for type-safe queries in React components
 */
export const useKysely = () => {
  const kysely = useMemo(() => {
    return wrapPowerSyncWithKysely<Database>(powerSync);
  }, []);

  return kysely;
};
