import "@/lib/security/server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const appsoluxSessionCookieName = "appsolux_session";

type AuthSessionPayload = {
  userId: string;
  tenantId: string;
  expiresAt: number;
};

function getAuthSecret() {
  const secret = process.env.APPSOLUX_AUTH_SECRET;

  if (!secret) {
    throw new Error("APPSOLUX_AUTH_SECRET no esta configurado.");
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string) {
  const expectedSignature = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createSessionToken(payload: AuthSessionPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readSessionToken(token: string): AuthSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!verifySignature(encodedPayload, signature)) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as AuthSessionPayload;

  if (payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function getSessionPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(appsoluxSessionCookieName)?.value;

  return token ? readSessionToken(token) : null;
}

export async function setAuthSession(input: {
  userId: string;
  tenantId: string;
}) {
  const cookieStore = await cookies();
  const maxAge = 60 * 60 * 24 * 7;
  const token = createSessionToken({
    userId: input.userId,
    tenantId: input.tenantId,
    expiresAt: Date.now() + maxAge * 1000,
  });

  cookieStore.set(appsoluxSessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();

  cookieStore.delete(appsoluxSessionCookieName);
}
