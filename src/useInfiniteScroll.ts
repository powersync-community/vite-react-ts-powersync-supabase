import { useState, useRef, useEffect, useCallback } from "react";
import { powerSync } from "./powersync/System";
import type { WatchedQueryDifferential } from "@powersync/web";

export const useInfiniteScroll = <
  T extends { id: string },          // Generic type T represents a row object in your table; it must have an 'id' property
  K extends keyof T & string         // K is a key of T used as the cursor for pagination (e.g., timestamp or auto-increment id)
>({
  infiniteData,                      // The current array of loaded rows
  setInfiniteData,                   // Setter function to update the array of loaded rows
  onDiff,                            // Callback function that receives the differential (new/changed/deleted) records
  table,                             // The table name to fetch data from
  cursor,                            // The field to use as the cursor for pagination
  limit = 6,                         // Maximum number of rows to fetch per "page" (default is 6)
}: {
  infiniteData: T[];             
  setInfiniteData: React.Dispatch<React.SetStateAction<T[]>>;
  onDiff: (diff: WatchedQueryDifferential<T>) => void;
  table: string;
  cursor: K;
  limit?: number;
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [lastCursorValue, setLastCursorValue] = useState<T[K]>("" as T[K]);

  // Create/update differential query that watches only the data we've loaded so far
  useEffect(() => {
    console.log("Creating differential watch for loaded data range");

    // Determine the range of data we want to watch
    let query;
    if (infiniteData.length === 0) {
      // Initial state - watch first batch
      query = powerSync.query<T>({
        sql: `
          SELECT *
          FROM ${table}
          ORDER BY ${cursor} ASC
          LIMIT ?
        `,
        parameters: [limit],
      });
    } else {
      // We have data - watch everything up to our max loaded cursor
      console.log("Watching data up to cursor value:", lastCursorValue);
      query = powerSync.query<T>({
        sql: `
          SELECT *
          FROM ${table}
          WHERE ${cursor} <= ?
          ORDER BY ${cursor} ASC
        `,
        parameters: [String(lastCursorValue)],
      });
    }

    const diffQuery = query.differentialWatch();

    const dispose = diffQuery.registerListener({
      onError: (err) => console.error("Differential watch error:", err),
      onData: (rows) => {
        console.log("onData received", rows.length, "rows");
        const sortedRows = (rows as T[]).sort((a, b) =>
          (a[cursor] as string).localeCompare(b[cursor] as string)
        );

        if (sortedRows.length > 0 && lastCursorValue === "") {
          setLastCursorValue(sortedRows[sortedRows.length - 1][cursor]);
        }

        setIsLoading(false);
      },

      onDiff: (diff) => {
        onDiff(diff);
      },
    });

    if (infiniteData.length === 0) {
      setIsLoading(true);
    }

    return () => {
      dispose();
      diffQuery.close();
    };
  }, [lastCursorValue]); // Re-run on initial load or when we extend the range

  const loadMoreData = useCallback(async () => {
    if (isLoading || infiniteData.length === 0) return;

    console.log("Loading more data from cursor:", lastCursorValue);
    setIsLoading(true);
    const results = await powerSync.getAll<T>(
      `SELECT * 
      FROM ${table} 
      WHERE ${cursor} > ? 
      ORDER BY ${cursor} ASC 
      LIMIT ?`,
      [lastCursorValue, limit]
    );

    setInfiniteData((prev) => {
      const combined = [...prev, ...results];
      const seen = new Set<string>();
      // remove duplicates and sort
      return combined
        .filter((row) => {
          if (seen.has(row[cursor] as string)) return false;
          seen.add(row[cursor] as string);
          return true;
        })
        .sort((a, b) =>
          (a[cursor] as string).localeCompare(b[cursor] as string)
        );
    });

    if (results.length > 0)
      setLastCursorValue(results[results.length - 1][cursor]);
  }, [isLoading, infiniteData.length, table, cursor, lastCursorValue, limit]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (infiniteData.length === 0) return;

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
  }, [loadMoreData, infiniteData.length, isLoading]);

  return { sentinelRef, isLoading, infiniteData };
};
