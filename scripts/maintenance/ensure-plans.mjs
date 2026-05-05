import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  {
    key: "free",
    name: "Free",
    description: "Modo basico para iniciar ventas, clientes y stock simple.",
    limits: {
      products: 20,
      customers: 20,
      receipts: 20,
      openOrders: 10,
      activeCredits: 5,
      users: 1,
      warehouses: 1,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: false,
      sri: false,
      advanced_reports: false,
      automations: false,
    },
  },
  {
    key: "trial",
    name: "Trial",
    description: "Prueba del modo basico antes de activar un plan pagado.",
    limits: {
      products: 50,
      customers: 50,
      receipts: 50,
      openOrders: 20,
      activeCredits: 10,
      users: 1,
      warehouses: 1,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: false,
      sri: false,
      advanced_reports: false,
      automations: false,
    },
  },
  {
    key: "pro",
    name: "Pro",
    description: "Plan operativo con ERP dedicado y reportes avanzados.",
    limits: {
      products: 5000,
      customers: 5000,
      receipts: 10000,
      openOrders: 1000,
      activeCredits: 500,
      users: 10,
      warehouses: 5,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: true,
      sri: "future",
      advanced_reports: true,
      automations: true,
    },
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Plan con limites altos, ERP dedicado y soporte manual.",
    limits: {
      products: 100000,
      customers: 100000,
      receipts: 100000,
      openOrders: 10000,
      activeCredits: 10000,
      users: 100,
      warehouses: 50,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: true,
      sri: "manual",
      advanced_reports: true,
      automations: true,
    },
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: {
        ...plan,
        isActive: true,
      },
      update: {
        name: plan.name,
        description: plan.description,
        limits: plan.limits,
        features: plan.features,
        isActive: true,
      },
    });

    console.log(`Ensured plan: ${plan.key}`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to ensure plans:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
