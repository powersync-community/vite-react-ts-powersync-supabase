import { PowerSyncContext } from "@powersync/react";
import React, { useEffect } from "react";
import { powerSync, start } from "./System";

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  // Connect after the first paint, so the page can show sync progress.
  useEffect(() => {
    void start();
  }, []);

  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export default SystemProvider;
