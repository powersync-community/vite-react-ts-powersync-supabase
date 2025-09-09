import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useCallback, useEffect, useRef, useState } from "react";
import { powerSync } from "./powersync/System";

const LIMIT_INCREMENT = 6;

function App() {
  const [data, setData] = useState<CounterRecord[]>([]);
  const [loadedUpToId, setLoadedUpToId] = useState<string>(""); // Track how far we've loaded
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const diffQueryRef = useRef<any>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  console.log("Data length:", data.length, "Loaded up to ID:", loadedUpToId);

  // Create/update differential query that watches all currently loaded data
  useEffect(() => {
    if (data.length === 0) return; // Don't create watch until we have data
    
    console.log("Creating differential watch for all loaded data");
    
    // Clean up previous query if it exists
    if (diffQueryRef.current) {
      diffQueryRef.current.dispose?.();
      diffQueryRef.current.close?.();
    }

    // Create query that watches ALL currently loaded data (no limit)
    const maxLoadedId = data[data.length - 1].id;
    
    const baseQuery = powerSync.query<CounterRecord>({
      sql: `
        SELECT *
        FROM ${COUNTER_TABLE}
        WHERE id <= ?
        ORDER BY id ASC
      `,
      parameters: [maxLoadedId],
    });

    const diffQuery = baseQuery.differentialWatch();

    const dispose = diffQuery.registerListener({
      onError: (err) => console.error("Differential watch error:", err),

      onData: (rows) => {
        console.log("Differential watch onData received", rows.length, "rows");
        // Update our data with the current state from the database
        const newRows = rows as CounterRecord[];
        setData(newRows.sort((a, b) => a.id.localeCompare(b.id)));
      },

      onDiff: (diff) => {
        console.log("Differential watch onDiff received", diff);
        setData((prev) => {
          let updated = [...prev];

          // Apply updates to existing rows
          updated = updated.map((row) => {
            const u = diff.updated.find((d) => d.current.id === row.id);
            return u ? (u.current as CounterRecord) : row;
          });

          // Remove deleted rows
          const removedIds = diff.removed.map((r) => r.id);
          updated = updated.filter((row) => !removedIds.includes(row.id));

          // Add new rows that fall within our loaded range
          const newRows = diff.added as CounterRecord[];
          console.log("Adding", newRows.length, "new rows via diff");
          updated = [...updated, ...newRows];

          // Deduplicate and sort
          const seen = new Set<string>();
          updated = updated
            .filter((row) => {
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            })
            .sort((a, b) => a.id.localeCompare(b.id));

          return updated;
        });
      },
    });

    diffQueryRef.current = {
      query: diffQuery,
      dispose,
      close: () => diffQuery.close()
    };

    return () => {
      dispose();
      diffQuery.close();
    };
  }, [data.length]); // Re-run when we have new data to watch

  // Load more data using a separate differential watch for pagination
  const loadMoreData = useCallback(() => {
    if (isLoading) return;
    
    console.log("Loading more data from ID:", loadedUpToId);
    setIsLoading(true);
    
    // Create a query for the next batch of data
    const loadQuery = powerSync.query<CounterRecord>({
      sql: `
        SELECT *
        FROM ${COUNTER_TABLE}
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
      parameters: [loadedUpToId, LIMIT_INCREMENT],
    });

    const loadDiffWatch = loadQuery.differentialWatch();
    
    const dispose = loadDiffWatch.registerListener({
      onError: (err) => {
        console.error("Load query error:", err);
        setIsLoading(false);
      },

      onData: (rows) => {
        console.log("Load query onData received", rows.length, "new rows");
        const newRows = rows as CounterRecord[];
        
        if (newRows.length > 0) {
          const newMaxId = newRows[newRows.length - 1].id;
          console.log("New max ID:", newMaxId);
          
          setData((prev) => {
            // Add new rows to existing data
            const combined = [...prev, ...newRows];
            
            // Deduplicate and sort
            const seen = new Set<string>();
            return combined
              .filter((row) => {
                if (seen.has(row.id)) return false;
                seen.add(row.id);
                return true;
              })
              .sort((a, b) => a.id.localeCompare(b.id));
          });

          setLoadedUpToId(newMaxId);
        }
        
        setIsLoading(false);
        
        // Clean up the load query after we get the data
        dispose();
        loadDiffWatch.close();
      },

      // For pagination queries, we typically don't need onDiff since we just want the initial data
      onDiff: () => {
        // Could handle real-time updates to the pagination query if needed
      },
    });

  }, [loadedUpToId, isLoading]);

  // Load initial data on mount
  useEffect(() => {
    console.log("Loading initial data");
    loadMoreData();
  }, []); // Run once on mount

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (isLoading) return; // Don't set up observer while loading
    
    console.log("Setting up IntersectionObserver");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          console.log("Sentinel intersected, triggering loadMore");
          loadMoreData();
        }
      },
      { threshold: 0.1, rootMargin: "20px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [loadMoreData, isLoading]);

  return (
    <div className="app-container">
      {data.length === 0 && isLoading ? (
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
          {isLoading && <div>Loading more...</div>}
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