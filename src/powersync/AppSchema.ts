import { column, Schema, Table } from "@powersync/web";

export const COUNTER_TABLE = "counters";
export const CHURN_TABLE = "churn";

// The synced table. Sync rules put every counter in one global bucket, so a
// fresh client downloads all of them.
const counters = new Table({
  owner_id: column.text,
  count: column.integer,
  created_at: column.text,
});

// Local-only scratch table the repro script writes to. Local-only means these
// rows never reach the upload queue or the server, so the script can generate
// as much write traffic as it likes without touching real data. The point is
// the write traffic itself: it is what makes the VFS fill a WAL file, swap to
// the other one and checkpoint, which is the race the bug lives in.
const churn = new Table(
  {
    data: column.text,
  },
  { localOnly: true }
);

export const AppSchema = new Schema({
  counters,
  churn,
});

export type Database = (typeof AppSchema)["types"];
export type CounterRecord = Database["counters"];
