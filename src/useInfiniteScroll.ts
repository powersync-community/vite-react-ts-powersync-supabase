import { useState, useRef, useEffect, useCallback } from "react";
import { powerSync } from "./powersync/System";
import type { WatchedQueryDifferential } from "@powersync/web";

export const useInfiniteScroll = <
  T extends { id: string },
  K extends keyof T & string
>({
  onDiff,
  onData,
  table,
  cursor,
  limit = 6,
}: {
  onDiff: (diff: WatchedQueryDifferential<T>) => void;
  onData: (data: T[]) => void;
  table: string;
  cursor: K;
  limit?: number;
}) => {
  const [infiniteData, setInfiniteData] = useState<T[]>([]);
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
      // We have data - watch everything up to our max loaded ID
      //   const maxId = infiniteData[infiniteData.length - 1][cursor];
      console.log("Watching data up to cursor value:", lastCursorValue);
      query = powerSync.query<T>({
        sql: `
          SELECT *
          FROM ${table}
          WHERE ${cursor} <= ?
          ORDER BY id ASC
        `,
        parameters: [String(lastCursorValue)],
      });
    }

    const diffQuery = query.differentialWatch();

    const dispose = diffQuery.registerListener({
      onError: (err) => console.error("Differential watch error:", err),
      onData: (rows) => {
        console.log("onData received", rows.length, "rows");
        // const newRows = rows as T[];
        const sortedRows = (rows as T[]).sort((a, b) =>
          (a[cursor] as string).localeCompare(b[cursor] as string)
        );
        // setData(sortedRows);
        onData(sortedRows);

        if (sortedRows.length > 0 && lastCursorValue === "") {
          // This is initial load, set the loadedUpToId
          //   setLoadedUpToId(sortedRows[sortedRows.length - 1].id);
          setLastCursorValue(sortedRows[sortedRows.length - 1][cursor]);
        }

        setIsLoading(false);
      },

      onDiff: (diff) => {
        console.log("onDiff received", diff);
        onDiff(diff);
        setInfiniteData((prev) => {
          // Replace existing rows with updated versions
          let updated = prev.map((row) => {
            const u = diff.updated.find((d) => d.current.id === row.id);
            return u ? (u.current as T) : row;
          });

          // Remove deleted rows
          const removedIds = diff.removed.map((r) => r.id);
          updated = updated.filter((row) => !removedIds.includes(row.id));

          // Add new rows
          const newRows = diff.added;
          if (newRows.length > 0) {
            console.log("Adding", newRows.length, "new rows via diff");
            updated = [...updated, ...newRows];
          }

          // Deduplicate and sort
          const seen = new Set<string>();
          const result = updated
            .filter((row) => {
              if (seen.has(row[cursor] as string)) return false;
              seen.add(row[cursor] as string);
              return true;
            })
            .sort((a, b) =>
              (a[cursor] as string).localeCompare(b[cursor] as string)
            );

          return result;
        });
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

    console.log("Loading more data from ID:", lastCursorValue);
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
