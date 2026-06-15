import "@/lib/security/server-only";

import { clearAuthSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutEverywhere() {
  const supabase = await createSupabaseServerClient({ writable: true });

  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("[auth] Supabase logout failed", {
        message: error instanceof Error ? error.message : "Unknown Supabase logout error",
      });
    }
  }

  await clearAuthSession();
}
