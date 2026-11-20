import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  findOrCreateAppsoluxUserForClerk,
} from "@/lib/auth/clerk-user";
import { getMobileUserProfile } from "@/lib/auth/mobile-user";

export async function GET() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }

  let profile = await getMobileUserProfile(clerkUserId);

  if (!profile) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId).catch(() => null);
    if (!clerkUser) {
      return NextResponse.json(
        { ok: false, error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado." } },
        { status: 401 },
      );
    }
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    if (!primaryEmail?.emailAddress) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_EMAIL", message: "No se encontró un correo verificado." } },
        { status: 401 },
      );
    }
    await findOrCreateAppsoluxUserForClerk({
      clerkUserId,
      email: primaryEmail.emailAddress,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        primaryEmail.emailAddress.split("@")[0],
      emailVerified: primaryEmail.verification?.status === "verified",
    });
    profile = await getMobileUserProfile(clerkUserId);
  }

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado en el sistema." } },
      { status: 401 },
    );
  }

  if (profile.status === "disabled") {
    return NextResponse.json(
      { ok: false, error: { code: "USER_DISABLED", message: "Tu cuenta está deshabilitada." } },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
    },
    tenants: profile.tenants,
  });
}
