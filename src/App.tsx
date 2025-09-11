import { useState } from "react";
import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useInfiniteScroll } from "./useInfiniteScroll";

const LIMIT_INCREMENT = 15;

function App() {
  const [data, setData] = useState<CounterRecord[]>([]);

  const {
    isLoading,
    sentinelRef,
  } = useInfiniteScroll<CounterRecord, "id">({
    infiniteData: data,
    setInfiniteData: setData,
    table: COUNTER_TABLE,
    cursor: "id",
    limit: LIMIT_INCREMENT,
    onDiff: (diff) => {
      // Update your loaded data array with changes from the diff
      setData((prev) => {
          // Replace existing rows with updated versions
          let updated = prev.map((row) => {
            const u = diff.updated.find((d) => d.current.id === row.id);
            return u ? (u.current as CounterRecord) : row;
          });

          // Remove deleted rows
          const removedIds = diff.removed.map((r) => r.id);
          updated = updated.filter((row) => !removedIds.includes(row.id));

          // Add new rows
          const newRows = diff.added;
          if (newRows.length > 0) {
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
            .sort((a, b) =>
              (a.id as string).localeCompare(b.id as string)
            );

          return result;
        });
    },
  });

  return (
    <div className="app-container">
      {data.length === 0 && isLoading ? (
        <div>Loading counters...</div>
      ) : (
        <div
          className="counter-grid"
          style={{
            maxHeight: "calc(100vh - 50px)",
            overflowY: "auto",
            position: "relative",
          }}
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
