import type { AppsoluxUser } from "./user";

export type N8nRegisterPayload = {
  name: string;
  email: string;
  company: string;
  phone?: string;
  business_type?: string;
  country?: string;
  base_currency?: string;
  initial_plan?: string;
  source?: string;
};

export type N8nRegisterResponse = {
  success: boolean;
  user?: AppsoluxUser;
  error?: string;
};
