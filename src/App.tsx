import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useCallback, useEffect, useRef, useState } from "react";
import { powerSync } from "./powersync/System";

const LIMIT_INCREMENT = 3;

function App() {
  const [lastId, setLastId] = useState<string>(""); // Track the last ID for pagination
  const [data, setData] = useState<CounterRecord[]>([]);
  const diffQueryRef = useRef<any>(null); // Ref to hold the differential watched query
  const sentinelRef = useRef<HTMLDivElement>(null);

  console.log("Data length:", data.length, "Last ID:", lastId);

  // Initialize and update the differential query when lastId changes
  useEffect(() => {
    console.log("Creating query with lastId:", lastId);
    // Create the query with the current lastId and limit
    const baseQuery = powerSync.query<CounterRecord>({
      sql: `
        SELECT *
        FROM ${COUNTER_TABLE}
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
      parameters: [lastId, LIMIT_INCREMENT],
    });

    // Create differential watch
    const diffQuery = baseQuery.differentialWatch();

    // Register the listener
    const dispose = diffQuery.registerListener({
      onError: (err) => console.error("Query error:", err),

      // onData for initial load
      onData: (rows) => {
        console.log("onData received", rows.length, "rows");
        setData((prev) => {
          const newRows = rows as CounterRecord[];
          const updated = [...prev, ...newRows];
          // Deduplicate by ID
          const seen = new Set<string>();
          return updated
            .filter((row) => {
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            })
            .sort((a, b) => a.id.localeCompare(b.id));
        });
      },

      // onDiff for updates, including new rows from DB changes
      onDiff: (diff) => {
        console.log("onDiff received", diff);
        setData((prev) => {
          let updated = [...prev];

          // Apply updates to existing rows
          updated = updated.map((row) => {
            const u = diff.updated.find((d) => d.current.id === row.id);
            return u ? (u.current as CounterRecord) : row;
          });

          // Remove rows that were deleted
          const removedIds = diff.removed.map((r) => r.id);
          updated = updated.filter((row) => !removedIds.includes(row.id));

          // Add new rows (from DB changes)
          const newRows = diff.added as CounterRecord[];
          console.log("Adding", newRows.length, "new rows");
          updated = [...updated, ...newRows];

          // Deduplicate by ID
          const seen = new Set<string>();
          updated = updated.filter((row) => {
            if (seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
          });

          // Sort by id to ensure order
          updated.sort((a, b) => a.id.localeCompare(b.id));

          console.log("Updated data length:", updated.length);
          return updated;
        });
      },
    });

    // Store the diffQuery in ref
    diffQueryRef.current = diffQuery;

    return () => {
      console.log("Cleaning up query with lastId:", lastId);
      dispose();
      diffQuery.close();
    };
  }, [lastId]); // Re-run when lastId changes

  // Load more: update the lastId to the last row's ID
  const loadMore = useCallback(() => {
    console.log("loadMore triggered");
    setLastId((prev) => {
      const newLastId = data.length > 0 ? data[data.length - 1].id : prev;
      console.log("Updating lastId to:", newLastId);
      return newLastId;
    });
  }, [data]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    console.log("Setting up IntersectionObserver");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log("Sentinel intersected, triggering loadMore");
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "20px" }
    );

    if (sentinelRef.current) {
      console.log("Observing sentinel");
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        console.log("Unobserving sentinel");
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [loadMore]); // Depend on loadMore, which depends on data

  return (
    <div className="app-container">
      {data.length === 0 ? (
        <div>Loading counters...</div>
      ) : (
        <div
          className="counter-grid"
          style={{ maxHeight: "400px", overflowY: "auto", position: "relative" }}
        >
          {data.map((counter) => (
            <div key={counter.id} className="counter-card">
              <p>Counter ID: {counter.id}</p>
              <p className="counter-count">Count: {counter.count ?? 0}</p>
              <p className="counter-date">
                Created:{" "}
                <strong>
                  {new Date(counter.created_at ?? "").toLocaleString()}
                </strong>
              </p>
            </div>
          ))}
          {/* Sentinel element for infinite scroll trigger */}
          <div
            ref={sentinelRef}
            style={{ height: "1px", width: "100%", background: "transparent" }}
          />
        </div>
      )}
    </div>
  );
}

export default App;