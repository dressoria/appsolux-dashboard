import "@/lib/security/server-only";
import type {
  AppsoluxPermission,
  AppsoluxUser,
  AppsoluxUserRole,
} from "@/types/user";

export type AppsoluxModule =
  | "dashboard"
  | "conversations"
  | "channels"
  | "automations"
  | "notifications"
  | "erp"
  | "pos"
  | "reports"
  | "settings"
  | "billing";

const rolePermissions: Record<AppsoluxUserRole, AppsoluxPermission[]> = {
  owner: [
    "dashboard:read",
    "conversations:read",
    "conversations:write",
    "channels:read",
    "channels:manage",
    "automations:read",
    "notifications:read",
    "erp:read",
    "erp:manage",
    "pos:read",
    "pos:sell",
    "reports:read",
    "settings:read",
    "settings:manage",
    "billing:read",
  ],
  admin: [
    "dashboard:read",
    "conversations:read",
    "conversations:write",
    "channels:read",
    "channels:manage",
    "automations:read",
    "notifications:read",
    "erp:read",
    "erp:manage",
    "pos:read",
    "pos:sell",
    "reports:read",
    "settings:read",
    "settings:manage",
    "billing:read",
  ],
  support: [
    "dashboard:read",
    "conversations:read",
    "conversations:write",
    "channels:read",
    "notifications:read",
  ],
  seller: [
    "dashboard:read",
    "erp:read",
    "pos:read",
    "pos:sell",
    "reports:read",
  ],
  viewer: [
    "dashboard:read",
    "conversations:read",
    "channels:read",
    "notifications:read",
    "erp:read",
    "pos:read",
    "reports:read",
    "billing:read",
  ],
};

const moduleReadPermission: Record<AppsoluxModule, AppsoluxPermission> = {
  dashboard: "dashboard:read",
  conversations: "conversations:read",
  channels: "channels:read",
  automations: "automations:read",
  notifications: "notifications:read",
  erp: "erp:read",
  pos: "pos:read",
  reports: "reports:read",
  settings: "settings:read",
  billing: "billing:read",
};

export function isTenantOwner(user: AppsoluxUser): boolean {
  return user.role === "owner";
}

export function isTenantAdmin(user: AppsoluxUser): boolean {
  return user.role === "owner" || user.role === "admin";
}

export function canManageSettings(user: AppsoluxUser): boolean {
  return isTenantAdmin(user);
}

export function getRolePermissions(
  role: AppsoluxUserRole
): AppsoluxPermission[] {
  return rolePermissions[role];
}

export function hasPermission(
  user: AppsoluxUser,
  permission: AppsoluxPermission
) {
  return (
    getRolePermissions(user.role).includes(permission) ||
    Boolean(user.permissions?.includes(permission))
  );
}

export function canAccessModule(
  user: AppsoluxUser,
  module: AppsoluxModule
) {
  return hasPermission(user, moduleReadPermission[module]);
}
