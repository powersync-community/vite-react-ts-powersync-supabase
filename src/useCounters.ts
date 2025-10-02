import { useQuery } from "@powersync/react";
import { powerSync } from "./powersync/System";
import { wrapPowerSyncWithKysely } from '@powersync/kysely-driver';
import type { Database } from "./powersync/AppSchema";

export function useCounters() {
    const db = wrapPowerSyncWithKysely<Database>(powerSync);

    return useQuery(
      db
        .selectFrom("counters")
        .select([
          "id",
          "owner_id",
          "count",
          "created_at",
        ])
    )
  }