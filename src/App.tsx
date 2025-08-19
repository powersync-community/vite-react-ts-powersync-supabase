import "./App.css";
import { useQuery, useStatus } from "@powersync/react";
import { COUNTER_TABLE, type CounterRecord } from "./powersync/AppSchema";
import { useEffect, useState } from "react";
import { powerSync } from "./powersync/System";
import { connector } from "./powersync/SupabaseConnector";

function App() {
  const [userID, setUserID] = useState<string | null>(null);
  const status = useStatus();

  // Example of a watch query using useQuery hook
  // This demonstrates how to fetch and automatically update data when the underlying table changes
  // using an incremental watch query - see here https://docs.powersync.com/usage/use-case-examples/watch-queries#incremental-watch-queries
  const { data: counters, isLoading } = useQuery<CounterRecord>(
    `SELECT * FROM ${COUNTER_TABLE} ORDER BY created_at ASC`,
    [],
    {
      rowComparator: {
        keyBy: (item) => item.id,
        compareBy: (item) => JSON.stringify(item)
      }
    }
  );

  // Get the current authenticated user's ID from Supabase on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await connector.client.auth.getUser();
      setUserID(user?.id || null);
    };

    getCurrentUser();
  }, []);

  // Example of executing a native SQLite query using PowerSync
  // This demonstrates how to directly execute SQL commands for data mutations
  const updateCounter = async (counter: CounterRecord, newCount: number) => {
    try {
      return await powerSync.execute(
        `UPDATE ${COUNTER_TABLE} SET count = ? WHERE owner_id = ?`,
        [newCount, counter.owner_id]
      );
    } catch (err) {
      console.error("Error updating counter:", err);
    }
  };

  // Function to create a new counter record for the current user
  // Uses native SQLite execution through PowerSync for data insertion
  const createCounter = async () => {
    // Ensure user is authenticated before creating counter
    if (!userID) {
      // If still no userID after fetch, don't proceed
      if (!userID) {
        console.error("Cannot create counter: No authenticated user");
        return;
      }
    }

    try {
      // Insert new counter with generated UUID, current user ID, and initial count of 0
      await powerSync.execute(
        `INSERT INTO ${COUNTER_TABLE} (id, owner_id, count, created_at) VALUES (uuid(), ?, ?, ?)`,
        [userID, 0, new Date().toISOString()]
      );
    } catch (err) {
      console.error("Error creating counter:", err);
    }
  };

  return (
    <div className="app-container">
      {/* Top row with Status, Logo, and Helpful Links in a grid like counter-grid */}
      <div className="top-grid">
        <div className="status-card">
          <h3>PowerSync Status</h3>
          <div className="mono-text">
            {/* SDK version of the rust core extension and it's hash - see here https://github.com/powersync-ja/powersync-sqlite-core/releases */}
            <div><strong>SDK Version:</strong> {powerSync.sdkVersion}</div>
            {status && (
              <>
                <div><strong>connected:</strong> {status.connected.toString()}</div>
                <div><strong>connecting:</strong> {status.connecting.toString()}</div>
                <div><strong>uploading:</strong> {status.dataFlowStatus?.uploading?.toString()}</div>
                <div><strong>downloading:</strong> {status.dataFlowStatus?.downloading?.toString()}</div>
                <div>
                  <strong>downloadProgress:</strong>{" "}
                  {status.downloadProgress?.downloadedFraction != null
                    ? `${(status.downloadProgress.downloadedFraction * 100).toFixed(2)}%`
                    : "0%"}
                </div>
                <div><strong>hasSynced:</strong> {status.hasSynced?.toString() ?? "false"}</div>
                <div><strong>lastSyncedAt:</strong> {status.lastSyncedAt?.toLocaleString() ?? "N/A"}</div>

                <div><strong>User ID:</strong> {userID || "Not authenticated"}</div>
              </>
            )}
          </div>
        </div>

        <div className="logo-card">
          <img src="/icons/icon.png" alt="Logo" className="logo-image" />
        </div>

        <div className="links-card">
          <h3>Helpful Links</h3>
          <ul className="links-list">
            <li>
              <a href="https://docs.powersync.com" target="_blank" rel="noopener noreferrer">
                PowerSync Documentation
              </a>
            </li>
            <li>
              <a href="https://accounts.journeyapps.com/portal" target="_blank" rel="noopener noreferrer">
                PowerSync Dashboard Portal
              </a>
            </li>
            <li>
              <a href="https://docs.powersync.com/usage/sync-rules" target="_blank" rel="noopener noreferrer">
                PowerSync Sync Rules
              </a>
            </li>
            <li>
              <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer">
                Supabase Dashboard
              </a>
            </li>
            <li>
              <a href="https://docs.powersync.com/integration-guides/supabase-+-powersync" target="_blank" rel="noopener noreferrer">
                Supabase + PowerSync Guide
              </a>
            </li>
            <li>
              <a href="https://supabase.com/docs/guides/auth" target="_blank" rel="noopener noreferrer">
                Supabase Auth Guide
              </a>
            </li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          {/* Show authentication status or create counter button */}
          {!userID ? (
            <p>Please sign in to create a counter.</p>
          ) : (
            <>
              {/* Only visible if the current user has not created a counter */}
              {!counters.some((c) => c.owner_id === userID) && (
                <div className="centered">
                  <button onClick={createCounter} className="primary-button">
                    Create Counter
                  </button>
                </div>
              )}

              <div className="counter-grid">
                {counters.map((counter) => (
                  <div key={counter.owner_id} className="counter-card">
                    <p>Counter for Id: {counter.owner_id}</p>
                    <p className="counter-count">Count: {counter.count}</p>
                    <p className="counter-date">
                      Created at: <strong>{new Date(counter.created_at ?? '').toLocaleString()}</strong>
                    </p>
                    <button
                      onClick={() => updateCounter(counter, (counter.count ?? 0) + 1)}
                      className="primary-button"
                    >
                      Increment
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;