import { PowerSyncContext } from "@powersync/react";
import React from "react";
import { powerSync } from "./System";

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export default SystemProvider;
