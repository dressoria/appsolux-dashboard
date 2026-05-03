import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export type {
  AppsoluxPermission,
  AppsoluxUser,
  AppsoluxUserRole,
} from "@/types/user";

export type { AppsoluxTenant } from "@/types/tenant";

export type AuthenticatedAppsoluxSession = {
  user: AppsoluxUser;
  tenant: AppsoluxTenant;
};
