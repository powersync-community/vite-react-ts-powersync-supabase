import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useCallback, useEffect, useRef, useState } from "react";
import { powerSync } from "./powersync/System";

const LIMIT_INCREMENT = 6;

function App() {
  const [data, setData] = useState<CounterRecord[]>([]);
  const [loadedUpToId, setLoadedUpToId] = useState<string>(""); 
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const diffQueryRef = useRef<any>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  console.log("Data length:", data.length, "Loaded up to ID:", loadedUpToId);

  // Create/update differential query that watches only the data we've loaded so far
  useEffect(() => {
    console.log("Creating differential watch for loaded data range");
    
    // Clean up previous query if it exists
    if (diffQueryRef.current) {
      diffQueryRef.current.dispose?.();
      diffQueryRef.current.close?.();
    }

    // Determine the range of data we want to watch
    let query;
    if (data.length === 0) {
      // Initial state - watch first batch
      query = powerSync.query<CounterRecord>({
        sql: `
          SELECT *
          FROM ${COUNTER_TABLE}
          ORDER BY id ASC
          LIMIT ?
        `,
        parameters: [LIMIT_INCREMENT],
      });
    } else {
      // We have data - watch everything up to our max loaded ID
      const maxId = data[data.length - 1].id;
      query = powerSync.query<CounterRecord>({
        sql: `
          SELECT *
          FROM ${COUNTER_TABLE}
          WHERE id <= ?
          ORDER BY id ASC
        `,
        parameters: [maxId],
      });
    }

    const diffQuery = query.differentialWatch();

    const dispose = diffQuery.registerListener({
      onError: (err) => console.error("Differential watch error:", err),

      onData: (rows) => {
        console.log("onData received", rows.length, "rows");
        const newRows = rows as CounterRecord[];
        const sortedRows = newRows.sort((a, b) => a.id.localeCompare(b.id));
        setData(sortedRows);
        
        if (sortedRows.length > 0 && loadedUpToId === "") {
          // This is initial load, set the loadedUpToId
          setLoadedUpToId(sortedRows[sortedRows.length - 1].id);
        }
        
        setIsLoading(false);
      },

      onDiff: (diff) => {
        console.log("onDiff received", diff);
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

          // Add new rows
          const newRows = diff.added as CounterRecord[];
          if (newRows.length > 0) {
            console.log("Adding", newRows.length, "new rows via diff");
            updated = [...updated, ...newRows];
          }

          // Deduplicate and sort
          const seen = new Set<string>();
          const result = updated
            .filter((row) => {
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            })
            .sort((a, b) => a.id.localeCompare(b.id));

          return result;
        });
      },
    });

    diffQueryRef.current = {
      query: diffQuery,
      dispose,
      close: () => diffQuery.close()
    };

    if (data.length === 0) {
      setIsLoading(true);
    }

    return () => {
      dispose();
      diffQuery.close();
    };
  }, [data.length === 0 ? true : loadedUpToId]); // Re-run on initial load or when we extend the range

  // Load more data
  const loadMoreData = useCallback(() => {
    if (isLoading || data.length === 0) return;
    
    console.log("Loading more data from ID:", loadedUpToId);
    setIsLoading(true);
    
    // Create a temporary query for the next batch
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
        console.log("Load more onData received", rows.length, "new rows");
        const newRows = rows as CounterRecord[];
        
        if (newRows.length > 0) {
          // Add new rows to existing data
          setData((prev) => {
            const combined = [...prev, ...newRows];
            const seen = new Set<string>();
            return combined
              .filter((row) => {
                if (seen.has(row.id)) return false;
                seen.add(row.id);
                return true;
              })
              .sort((a, b) => a.id.localeCompare(b.id));
          });

          // Update loadedUpToId to extend the watch range
          const newMaxId = newRows[newRows.length - 1].id;
          setLoadedUpToId(newMaxId);
        }
        
        setIsLoading(false);
        
        // Clean up the load query
        dispose();
        loadDiffWatch.close();
      },

      onDiff: () => {
        // We don't need diff handling on pagination queries
      },
    });

  }, [loadedUpToId, isLoading, data.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (data.length === 0) return;
    
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
  }, [loadMoreData, data.length, isLoading]);

  return (
    <div className="app-container">
      {data.length === 0 && isLoading ? (
        <div>Loading counters...</div>
      ) : (
        <div
          className="counter-grid"
          style={{ maxHeight: "300px", overflowY: "auto", position: "relative" }}
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
          {isLoading && data.length > 0 && <div>Loading more...</div>}
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