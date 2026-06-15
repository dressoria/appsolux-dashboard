import "@/lib/security/server-only";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  requireSupabasePublicConfig,
} from "@/lib/supabase/config";

export function getSupabaseAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
