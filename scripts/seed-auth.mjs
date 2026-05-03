import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} es requerido para seed:auth`);
  }

  return value;
}

async function main() {
  const email = getRequiredEnv("APPSOLUX_DEV_EMAIL").toLowerCase();
  const password = getRequiredEnv("APPSOLUX_DEV_PASSWORD");
  const name = process.env.APPSOLUX_DEV_NAME ?? "Appsolux Admin";
  const tenantName = process.env.APPSOLUX_DEV_TENANT_NAME ?? "Milusk";
  const tenantSlug = process.env.APPSOLUX_DEV_TENANT_SLUG ?? "milusk";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      status: "active",
    },
    create: {
      name,
      email,
      passwordHash,
      status: "active",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      name: tenantName,
      status: "active",
    },
    create: {
      name: tenantName,
      slug: tenantSlug,
      country: process.env.APPSOLUX_DEV_COUNTRY ?? "Ecuador",
      currency: process.env.APPSOLUX_DEV_CURRENCY ?? "USD",
      status: "active",
      planKey: "starter",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {
      role: "owner",
      status: "active",
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "owner",
      status: "active",
    },
  });

  console.log(`Seed auth listo para ${email} en tenant ${tenant.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
