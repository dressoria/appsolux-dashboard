import "@/lib/security/server-only";

import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { resolvePaddleBillingAvailability } from "./paddle-availability-policy.ts";

let paddleClient: Paddle | null = null;

export function getPaddleBillingAvailability(env: NodeJS.ProcessEnv = process.env) {
  return resolvePaddleBillingAvailability(env);
}

export function getPaddleEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  return env.PADDLE_ENV?.trim() === "production" ? Environment.production : Environment.sandbox;
}

function requireServerEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

export function getPaddleClient() {
  if (!paddleClient) {
    paddleClient = new Paddle(requireServerEnv("PADDLE_API_KEY"), {
      environment: getPaddleEnvironment(),
    });
  }
  return paddleClient;
}

export function getPaddleWebhookSecret() {
  return requireServerEnv("PADDLE_WEBHOOK_SECRET");
}

export function getPaddleClientToken() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  if (!token) throw new Error("Falta configurar NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.");
  return token;
}

export function getBillingAppUrl() {
  const value =
    process.env.PLATFORM_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) throw new Error("Falta configurar PLATFORM_PUBLIC_URL o NEXT_PUBLIC_APP_URL.");
  return value.replace(/\/$/, "");
}
