import type { AppsoluxTenant } from "./tenant";

export type AppsoluxUserRole = "owner" | "admin" | "agent";

export type AppsoluxUser = {
  id: string;
  name: string;
  email: string;
  role: AppsoluxUserRole;
  tenant: AppsoluxTenant;
};