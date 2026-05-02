export type NotificationCategory =
  | "payment"
  | "receipt"
  | "automation"
  | "lead"
  | "inventory"
  | "order"
  | "system";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type NotificationStatus = "unread" | "read" | "archived";

export type NotificationSource =
  | "appsolux"
  | "n8n"
  | "chatwoot"
  | "erpnext"
  | "evolution"
  | "meta";

export type AppsoluxNotification = {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  created_at: string;
  source: NotificationSource;
};
