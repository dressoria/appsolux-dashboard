import "@/lib/security/server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no esta configurado. Configura la Appsolux Core DB antes de usar persistencia."
    );
  }
}

export function getPrismaClient() {
  assertDatabaseUrl();

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient;
