import "@/lib/security/server-only";

export type AppsoluxAuthProvider = "current" | "dual" | "supabase";

export function getAppsoluxAuthProvider(): AppsoluxAuthProvider {
  const value = process.env.APPSOLUX_AUTH_PROVIDER?.trim().toLowerCase();

  if (value === "dual" || value === "supabase") {
    return value;
  }

  return "current";
}

export function shouldTrySupabaseAuth(provider = getAppsoluxAuthProvider()) {
  return provider === "dual" || provider === "supabase";
}

export function shouldTryCurrentAuth(provider = getAppsoluxAuthProvider()) {
  return provider === "dual" || provider === "current";
}
