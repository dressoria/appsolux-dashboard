import "@/lib/security/server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

type CreateSupabaseServerClientOptions = {
  writable?: boolean;
};

export async function hasSupabaseSessionCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.getAll().some((c) => c.name.startsWith("sb-"));
}

export async function createSupabaseServerClient(
  options: CreateSupabaseServerClientOptions = {}
) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  const writable = options.writable ?? false;

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        if (!writable) {
          // Server Components have a read-only cookie store; silently skip writes
          // to prevent the Supabase SSR "missing setAll" warning without throwing.
          return;
        }
        for (const cookie of cookiesToSet) {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}
