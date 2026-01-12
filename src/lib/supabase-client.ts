import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  "";

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
  return cachedClient;
}
