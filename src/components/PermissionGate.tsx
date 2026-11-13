"use client";

import { useApp } from "@/context/AppContext";
import { canAccess } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/types";
import type { ReactNode } from "react";

export function PermissionGate({
  module,
  action = "view",
  children,
}: {
  module: ModuleKey;
  action?: "view" | "add" | "edit";
  children: ReactNode;
}) {
  const { user, settings, loading } = useApp();
  if (loading) return <p role="status">Loading...</p>;
  if (!canAccess(user, settings, module, action)) {
    return (
      <div className="dashboard-placeholder">
        <h2>Permission denied</h2>
        <p>You do not have access to this section. Ask the clinic doctor to update receptionist permissions in Settings.</p>
      </div>
    );
  }
  return <>{children}</>;
}
