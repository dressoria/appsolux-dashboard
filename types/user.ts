import type { AppsoluxTenant } from "./tenant";

export type AppsoluxUserRole =
  | "owner"
  | "admin"
  | "support"
  | "seller"
  | "viewer";

export type AppsoluxPermission =
  | "dashboard:read"
  | "conversations:read"
  | "conversations:write"
  | "channels:read"
  | "channels:manage"
  | "automations:read"
  | "notifications:read"
  | "erp:read"
  | "erp:manage"
  | "pos:read"
  | "pos:sell"
  | "reports:read"
  | "settings:read"
  | "settings:manage"
  | "billing:read";

export type AppsoluxUser = {
  id: string;
  name: string;
  email: string;
  role: AppsoluxUserRole;
  permissions?: AppsoluxPermission[];
  tenant: AppsoluxTenant | null;
};
