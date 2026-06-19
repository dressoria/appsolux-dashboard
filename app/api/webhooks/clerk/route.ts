import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  syncClerkUserToDb,
  deactivateClerkUser,
} from "@/lib/auth/clerk-user";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
  verification?: { status: string } | null;
};

type ClerkUserPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
};

type ClerkWebhookEvent =
  | { type: "user.created" | "user.updated"; data: ClerkUserPayload }
  | { type: "user.deleted"; data: { id?: string } };

function getWebhookSecret(): string {
  const secret =
    process.env.CLERK_WEBHOOK_SIGNING_SECRET ??
    process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "CLERK_WEBHOOK_SIGNING_SECRET (o CLERK_WEBHOOK_SECRET) no esta configurado."
    );
  }

  return secret;
}

function getPrimaryEmail(
  payload: ClerkUserPayload
): ClerkEmailAddress | undefined {
  return payload.email_addresses?.find(
    (e) => e.id === payload.primary_email_address_id
  );
}

function buildUserName(payload: ClerkUserPayload, email: string): string {
  const parts = [payload.first_name, payload.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : email.split("@")[0];
}

export async function POST(request: Request) {
  let secret: string;

  try {
    secret = getWebhookSecret();
  } catch (error) {
    console.error("[clerk-webhook] Missing signing secret", error);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const body = await request.text();
  const wh = new Webhook(secret);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      const payload = event.data;
      const primaryEmail = getPrimaryEmail(payload);

      if (!primaryEmail?.email_address) {
        return NextResponse.json({ ok: true, skipped: "no_primary_email" });
      }

      await syncClerkUserToDb({
        clerkUserId: payload.id,
        email: primaryEmail.email_address,
        name: buildUserName(payload, primaryEmail.email_address),
        emailVerified: primaryEmail.verification?.status === "verified",
      });
    }

    if (event.type === "user.deleted") {
      const clerkUserId = event.data.id;

      if (clerkUserId) {
        await deactivateClerkUser(clerkUserId);
      }
    }
  } catch (error) {
    console.error("[clerk-webhook] Failed to process event", {
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
