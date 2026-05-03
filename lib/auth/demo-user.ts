import type { AppsoluxUser } from "@/types/user";

export const demoUser: AppsoluxUser = {
  id: "usr_demo_001",
  name: "Andres Soria",
  email: "131studio.ec@gmail.com",
  role: "owner",
  permissions: [],
  tenant: {
    id: "tenant_demo_milusk",
    name: "Milusk",
    slug: "milusk",

    // IMPORTANTE:
    // Este valor es demo. En produccion debe venir del tenant real.
    chatwoot_account_id: 2,

    erpnext_customer_id: "CUST-DEMO-001",
    erpnext_company_id: "Appsolux",

    channels: {
      evolution: {
        enabled: true,
        instance_name: "appsolux_milusk",
        status: "pending",
      },
      meta_whatsapp: {
        enabled: false,
        status: "pending",
      },
      instagram: {
        enabled: false,
        status: "pending",
      },
      messenger: {
        enabled: false,
        status: "pending",
      },
    },

    subscription: {
      plan: "starter",
      status: "trialing",
    },
  },
};
