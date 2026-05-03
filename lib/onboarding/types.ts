import type { AppsoluxUser } from "@/types/user";

export type OnboardingStatus = "pending" | "provisioning" | "ready" | "failed";

export type CreateOnboardingRequestInput = {
  user_name: string;
  email: string;
  password: string;
  password_confirm?: string;
  company_name: string;
  phone?: string;
  business_type?: string;
  country?: string;
  base_currency?: string;
  initial_plan?: string;
  source?: string;
};

export type NormalizedOnboardingRequest = {
  user_name: string;
  email: string;
  password: string;
  company_name: string;
  phone?: string;
  business_type?: string;
  country: string;
  base_currency?: string;
  initial_plan?: string;
  source: string;
};

export type OnboardingProvisioningResult = {
  status: OnboardingStatus;
  message: string;
  user?: AppsoluxUser;
};

export type OnboardingRegisterResponse = {
  status: OnboardingStatus;
  message: string;
  redirect_to?: string;
};
