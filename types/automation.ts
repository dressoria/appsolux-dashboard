export type AutomationCategory =
  | "inventory"
  | "payments"
  | "sales"
  | "support"
  | "follow_up"
  | "notifications"
  | "catalog"
  | "system";

export type AutomationStatus =
  | "available"
  | "active"
  | "paused"
  | "needs_setup"
  | "error";

export type AutomationTriggerType =
  | "manual"
  | "schedule"
  | "incoming_message"
  | "payment_received"
  | "inventory_low"
  | "new_lead"
  | "order_created";

export type AppsoluxAutomation = {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: AutomationCategory;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  required_setup: string[];
  last_run_at: string | null;
  result_summary: string;
};
