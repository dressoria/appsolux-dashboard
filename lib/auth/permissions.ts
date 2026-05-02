import "@/lib/security/server-only";
import type { AppsoluxUser } from "@/types/user";

export function isTenantOwner(user: AppsoluxUser): boolean {
  return user.role === "owner";
}

export function isTenantAdmin(user: AppsoluxUser): boolean {
  return user.role === "owner" || user.role === "admin";
}

export function canManageSettings(user: AppsoluxUser): boolean {
  return isTenantAdmin(user);
}