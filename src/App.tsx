import "./App.css";
import { useEffect, useState } from "react";
import { useQuery, useStatus } from "@powersync/react";
import { COUNTER_TABLE } from "./powersync/AppSchema";

export default function App() {
  const status = useStatus();

  const { data } = useQuery<{ total: number }>(
    `SELECT count(*) AS total FROM ${COUNTER_TABLE}`
  );
  const rows = data?.[0]?.total ?? 0;

  // Uncaught errors from the database workers bubble to the page, so the tab
  // itself shows when this tab's VFS has broken.
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      setErrors((prev) => [event.message, ...prev].slice(0, 6));
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  const fraction = status.downloadProgress?.downloadedFraction;
  const broken = errors.length > 0;

  return (
    <main className={broken ? "broken" : undefined}>
      <h1>OPFSWriteAheadVFS repro</h1>

      <dl>
        <dt>connected</dt>
        <dd>{String(status.connected)}</dd>
        <dt>downloading</dt>
        <dd>{String(status.downloading)}</dd>
        <dt>progress</dt>
        <dd>{fraction != null ? `${(fraction * 100).toFixed(1)}%` : "n/a"}</dd>
        <dt>hasSynced</dt>
        <dd>{String(status.hasSynced ?? false)}</dd>
        <dt>rows</dt>
        <dd>{rows.toLocaleString()}</dd>
        <dt>errors</dt>
        <dd>{errors.length}</dd>
      </dl>

      {broken && (
        <ul className="errors">
          {errors.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
