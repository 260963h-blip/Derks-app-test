import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireUserId(accessToken: string): Promise<string> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Authenticatieconfiguratie ontbreekt op de server.");
  }
  if (!accessToken?.trim()) {
    throw new Error("Je sessie is verlopen. Log opnieuw in.");
  }
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Je sessie is verlopen. Log opnieuw in.");
  }
  return data.user.id;
}
