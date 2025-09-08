import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useEffect, useRef, useState } from "react";
import { powerSync } from "./powersync/System";

const LIMIT_INCREMENT = 4;

function App() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<CounterRecord[]>([]);
  const lastItemRef = useRef<HTMLDivElement>(null);

  console.log("Data length:", data.length);

  // Watch query for counters
  useEffect(() => {
    // Get last id of the current data
    const lastId = data.length > 0
      ? data[data.length - 1].id
      : "";

    // Query for new data, order by id ascending, limit to LIMIT_INCREMENT
    const query = powerSync
      .query<CounterRecord>({
        sql: `
        SELECT *
        FROM ${COUNTER_TABLE}
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
        parameters: [lastId, LIMIT_INCREMENT],
      })
      .differentialWatch()

    const dispose = query.registerListener({
      onError: (err) => {
        console.error("Query error:", err);
      },
      onData: (rows) => {
        // setData((prev) => {
        //   const existingIds = new Set(prev.map(r => r.id));
        //   const newRows = (rows as CounterRecord[]).filter(r => !existingIds.has(r.id));
        //   return [...prev, ...newRows]; // no duplicates
        // });
        // setData(data => [...data, ...rows]);
        setData((prev) => [...prev, ...rows]);
      },
      // onDiff: (diff) => {
      //   console.log("Diff:", diff);
      // }
      // onData: (rows) => {
      //   // Only add new rows for initial load, onDiff will handle updates
      //   // if (rows.length == 0) {
      //   //   setData((prev) => [...prev, ...rows]);
      //   // }
      //   // setData(data => [...data, ...rows]);

      //   // setData((prev) => [...prev, ...rows]);
      //   // setData([...rows]);


      //   // setData((prev) => {
      //   //   const existingIds = new Set(prev.map(row => row.id));
      //   //   const newRows = (rows as CounterRecord[]).filter(row => !existingIds.has(row.id));
      //   //   return [...prev, ...newRows];
      //   // });

      //   setData((prev) => {
      //     // Combine previous data and new rows
      //     const combined = [...prev, ...(rows as CounterRecord[])];

      //     // Use a Map to remove duplicates by id
      //     const uniqueMap = new Map<string, CounterRecord>();
      //     for (const row of combined) {
      //       uniqueMap.set(row.id, row); // later rows overwrite earlier ones
      //     }

      //     // Return the array of unique rows
      //     return Array.from(uniqueMap.values());
      //   });


      //   // Make a shallow copy to trigger onDiff
      //   // setData(() => [...rows]);

      //   // setData((prev) => {
      //   //   const existingIds = new Set(prev.map(row => row.id));
      //   //   const newRows = rows.filter((r) => !existingIds.has(r.id));

      //   //   // Always return a new array reference, even if newRows is empty
      //   //   return [...prev, ...newRows] as CounterRecord[];
      //   // });
      // },
      onDiff: (diff) => {
        // This callback will be called whenever the data changes.
        // We need to update the existing data with the updated data

        console.log('Data Added:', diff.added);
        console.log('Data Updated:', diff.updated);
        console.log('Data Removed:', diff.removed);

        //Add new rows
        setData((prev) => {
          const existingIds = prev.map(row => row.id);
          console.log("Existing IDs:", existingIds);
          const newRows = (diff.added as CounterRecord[]).filter(row => !existingIds.includes(row.id));
          return [...prev, ...newRows];
        });

        //Update existing rows
        setData((prev) =>
          prev.map((row) => {
            const updatedRow = diff.updated.find(
              (diffRow) => diffRow.current.id === row.id
            );
            return updatedRow ? (updatedRow.current as CounterRecord) : row;
          })
        );

        //Remove deleted rows
        setData((prev) => prev.filter((row) => !diff.removed.some((diffRow) => row.id === diffRow.id)));
      }
    });

    return () => {
      dispose();
      query.close();
    };
  }, [offset]);

  // Load more: just bump the offset
  const loadMore = () => {
    setOffset((prev) => prev + LIMIT_INCREMENT);
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (lastItemRef.current) observer.observe(lastItemRef.current);
    return () => {
      if (lastItemRef.current) observer.unobserve(lastItemRef.current);
    };
  }, [data]);

  return (
    <div className="app-container">
      {data.length === 0 ? (
        <div>Loading counters...</div>
      ) : (
        <div
          className="counter-grid"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          {data.map((counter, index) => (
            <div
              key={counter.id}
              ref={index === data.length - 1 ? lastItemRef : null}
              className="counter-card"
            >
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
        </div>
      )}
    </div>
  );
};
export default App;
