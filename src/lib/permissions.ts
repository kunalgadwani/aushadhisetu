import type { AppUser, ClinicSettings, ModuleKey } from "@/lib/types";

export function canAccess(
  user: AppUser | null,
  settings: ClinicSettings | undefined,
  module: ModuleKey,
  action: "view" | "add" | "edit" = "view"
): boolean {
  if (!user) return false;
  if (user.role === "doctor") return true;
  return settings?.receptionistPermissions?.[module]?.[action] === true;
}
