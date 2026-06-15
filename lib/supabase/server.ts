import "@/lib/security/server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

type CreateSupabaseServerClientOptions = {
  writable?: boolean;
};

export async function createSupabaseServerClient(
  options: CreateSupabaseServerClientOptions = {}
) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: options.writable
      ? {
          getAll() {
            return cookieStore.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }));
          },
          setAll(cookiesToSet) {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          },
        }
      : {
          getAll() {
            return cookieStore.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }));
          },
        },
  });
}
