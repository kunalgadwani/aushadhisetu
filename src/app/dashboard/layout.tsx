"use client";

import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
