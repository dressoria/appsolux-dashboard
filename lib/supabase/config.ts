export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error("Supabase public config is not complete.");
  }

  return config;
}

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return value ? value : null;
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}
