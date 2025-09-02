import { column, Schema, Table } from "@powersync/web";

export const COUNTER_TABLE = "counters";
export const CATTLE_TABLE = "cattle";
export const RANCH_TABLE = "ranch";
export const VENDOR_TABLE = "vendor";
export const AI_SEMEN_SIRE_TABLE = "ai_semen_sire";
export const CATTLE_AI_TABLE = "cattle_ai";
export const CATTLE_BSE_TABLE = "cattle_bse";
export const CATTLE_EPD_TABLE = "cattle_epd";
export const CATTLE_PAP_TEST_TABLE = "cattle_pap_test";
export const CATTLE_PREGNANCY_TEST_TABLE = "cattle_pregnancy_test";
export const CATTLE_TRANSFER_TABLE = "cattle_transfer";
export const CATTLE_TREATMENT_TABLE = "cattle_treatment";
export const CATTLE_WEIGHT_TABLE = "cattle_weight";
export const GROUP_TABLE = "group";
export const GROUP_CATTLE_TABLE = "group_cattle";

// --- Table definitions --- //
const counters = new Table({
    owner_id: column.text,    // String field for identifying record owner
    count: column.integer,    // Counter value
    created_at: column.text,  // Timestamp
});

// Schema definition (similar to your cattle schema)
const todos = new Table(
    {
      list_id: column.text,
      created_at: column.text,
      completed_at: column.text,
      description: column.text,
      created_by: column.text,
      completed_by: column.text,
      completed: column.integer
    },
    { indexes: { list: ['list_id'] } }
  );
  
  const lists = new Table({
    created_at: column.text,
    name: column.text,
    owner_id: column.text
  });

// --- Schema --- //
export const AppSchema = new Schema({
    counters,
    todos,
    lists,
});

// --- Types --- //
export type Database = (typeof AppSchema)["types"];

export type CounterRecord = Database["counters"];
export type TodoRecord = Database["todos"];
export type ListRecord = Database["lists"];

