import "./App.css";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useInfiniteScroll } from "./useInfiniteScroll";

const LIMIT_INCREMENT = 15;

function App() {
  const {
    infiniteData: data,
    isLoading,
    sentinelRef,
  } = useInfiniteScroll<CounterRecord, "id">({
    table: COUNTER_TABLE,
    cursor: "id",
    limit: LIMIT_INCREMENT,
    onData: () => {},
    onDiff: (diff) => {
      console.log("App received diff", diff);
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
