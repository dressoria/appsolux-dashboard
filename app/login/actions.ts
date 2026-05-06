"use server";

import { redirect } from "next/navigation";

import { getLoginUserByEmail } from "@/lib/auth/persistent-user";
import { verifyPassword } from "@/lib/auth/password";
import { setAuthSession } from "@/lib/auth/session";

function getStringField(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function loginAction(formData: FormData) {
  const email = getStringField(formData, "email").trim().toLowerCase();
  const password = getStringField(formData, "password");

  if (!email || !password) {
    redirect("/login?error=credentials");
  }

  try {
    const user = await getLoginUserByEmail(email);

    if (!user || !user.passwordHash || user.status !== "active") {
      redirect("/login?error=credentials");
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      redirect("/login?error=credentials");
    }

    const membership = user.memberships[0];

    if (!membership) {
      redirect("/login?error=membership");
    }

    await setAuthSession({
      userId: user.id,
      tenantId: membership.tenantId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/login?error=login");
  }

  redirect("/dashboard");
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}
