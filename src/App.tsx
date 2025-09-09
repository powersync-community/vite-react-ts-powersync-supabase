import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@powersync/react";

const LIMIT_INCREMENT = 6;

function App() {
  const [lastId, setLastId] = useState<string>("");
  const [allData, setAllData] = useState<CounterRecord[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [shouldLoadMore, setShouldLoadMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  console.log("All data length:", allData.length, "Last ID:", lastId, "Should load more:", shouldLoadMore);

  // Query for the current batch of records (pagination)
  // Always use the same parameter structure to avoid React hooks issues
  const { data: currentBatch = [] } = useQuery<CounterRecord>(
    shouldLoadMore ? `
      SELECT *
      FROM ${COUNTER_TABLE}
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    ` : `
      SELECT *
      FROM ${COUNTER_TABLE}
      WHERE id > ?
      ORDER BY id ASC
      LIMIT 0
    `, // Same structure but LIMIT 0 when not loading
    [lastId, shouldLoadMore ? LIMIT_INCREMENT : 0] // Always 2 parameters
  );

  // Query to watch ALL records for real-time updates (not just loaded ones)
  // This ensures we get updates for any record that might become visible
  const { data: allRecords = [] } = useQuery<CounterRecord>(`
    SELECT *
    FROM ${COUNTER_TABLE}
    ORDER BY id ASC
  `, []);

  // Process new batch when it arrives
  useEffect(() => {
    if (currentBatch.length > 0 && shouldLoadMore) {
      console.log("Processing new batch of", currentBatch.length, "records");
      
      setAllData(prev => {
        // Combine existing data with new batch
        const combined = [...prev, ...currentBatch];
        
        // Deduplicate by ID
        const seen = new Set<string>();
        const deduplicated = combined.filter(record => {
          if (seen.has(record.id)) return false;
          seen.add(record.id);
          return true;
        });
        
        // Sort by ID to maintain order
        return deduplicated.sort((a, b) => a.id.localeCompare(b.id));
      });

      // Update lastId for next batch
      const newLastId = currentBatch[currentBatch.length - 1].id;
      setLastId(newLastId);

      // Check if we've reached the end
      if (currentBatch.length < LIMIT_INCREMENT) {
        setHasMore(false);
      }

      // Stop loading more until requested again
      setShouldLoadMore(false);
    }
  }, [currentBatch, shouldLoadMore]);

  // Filter and update displayed data from all records (for real-time updates)
  useEffect(() => {
    if (allRecords.length > 0 && allData.length > 0) {
      console.log("All records updated, filtering to show loaded records");
      
      // Get the IDs of records we've already loaded
      const loadedIds = new Set(allData.map(record => record.id));
      
      // Filter all records to only show the ones we've loaded (preserving real-time updates)
      const filteredRecords = allRecords
        .filter(record => loadedIds.has(record.id))
        .sort((a, b) => a.id.localeCompare(b.id));
      
      // Only update if the data actually changed to avoid infinite loops
      const currentIds = allData.map(r => r.id).join(',');
      const newIds = filteredRecords.map(r => r.id).join(',');
      const currentData = JSON.stringify(allData.map(r => ({ id: r.id, count: r.count })));
      const newData = JSON.stringify(filteredRecords.map(r => ({ id: r.id, count: r.count })));
      
      if (currentIds === newIds && currentData !== newData) {
        // Same records but different data (real-time update)
        console.log("Real-time update detected");
        setAllData(filteredRecords);
      }
    }
  }, [allRecords]); // Remove allData from dependencies to avoid infinite loops

  // Load initial batch on mount
  useEffect(() => {
    if (allData.length === 0 && !shouldLoadMore) {
      console.log("Loading initial batch");
      setShouldLoadMore(true);
    }
  }, [allData.length, shouldLoadMore]);

  // Load more function
  const loadMore = useCallback(() => {
    if (hasMore && !shouldLoadMore) {
      console.log("loadMore triggered");
      setShouldLoadMore(true);
    }
  }, [hasMore, shouldLoadMore]);

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
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [loadMore]);

  return (
    <div className="app-container">
      {allData.length === 0 ? (
        <div>Loading counters...</div>
      ) : (
        <div
          className="counter-grid"
          style={{ maxHeight: "400px", overflowY: "auto", position: "relative" }}
        >
          {allData.map((counter) => (
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
          {hasMore && (
            <div
              ref={sentinelRef}
              style={{ height: "1px", width: "100%", background: "transparent" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;