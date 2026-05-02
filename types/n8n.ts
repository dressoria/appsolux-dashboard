import type { AppsoluxUser } from "./user";

export type N8nRegisterPayload = {
  name: string;
  email: string;
  company: string;
};

export type N8nRegisterResponse = {
  success: boolean;
  user?: AppsoluxUser;
  error?: string;
};