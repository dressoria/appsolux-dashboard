export type ChannelStatus = "connected" | "disconnected" | "pending" | "error";

export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled";

export type EvolutionChannel = {
  enabled: boolean;
  instance_name?: string;
  status?: ChannelStatus;
};

export type MetaWhatsAppChannel = {
  enabled: boolean;
  waba_id?: string;
  phone_number_id?: string;
  status?: ChannelStatus;
};

export type InstagramChannel = {
  enabled: boolean;
  instagram_business_account_id?: string;
  status?: ChannelStatus;
};

export type MessengerChannel = {
  enabled: boolean;
  page_id?: string;
  status?: ChannelStatus;
};

export type AppsoluxTenantChannels = {
  evolution?: EvolutionChannel;
  meta_whatsapp?: MetaWhatsAppChannel;
  instagram?: InstagramChannel;
  messenger?: MessengerChannel;
};

export type AppsoluxTenantSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
};

export type AppsoluxTenant = {
  id: string;
  name: string;
  slug: string;

  chatwoot_account_id: number;

  erpnext_customer_id?: string;
  erpnext_company_id?: string;

  channels: AppsoluxTenantChannels;

  subscription?: AppsoluxTenantSubscription;
};