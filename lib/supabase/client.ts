import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = requireSupabasePublicConfig();

  browserClient = createBrowserClient(url, anonKey);

  return browserClient;
}
