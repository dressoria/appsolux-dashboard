"use server";

import { redirect } from "next/navigation";

import { signInWithCurrentPassword } from "@/lib/auth/current-password-login";
import { getAppsoluxAuthProvider, shouldTryCurrentAuth, shouldTrySupabaseAuth } from "@/lib/auth/provider";
import { signInWithSupabasePassword } from "@/lib/auth/supabase-password-login";

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
    const provider = getAppsoluxAuthProvider();

    if (shouldTrySupabaseAuth(provider)) {
      const supabaseResult = await signInWithSupabasePassword({
        email,
        password,
      });

      if (supabaseResult.ok) {
        redirect(supabaseResult.redirectTo);
      }
    }

    if (shouldTryCurrentAuth(provider)) {
      const currentResult = await signInWithCurrentPassword({
        email,
        password,
      });

      if (currentResult.ok) {
        redirect(currentResult.redirectTo);
      }
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/login?error=login");
  }

  redirect("/login?error=credentials");
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
