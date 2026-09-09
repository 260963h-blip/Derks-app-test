import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptConnectionKey, decryptConnectionKey } from "@/lib/connection-key-crypto.server";

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
) {
  const { error } = await (supabaseAdmin.from("app_user_connections") as any).upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(
  userId: string,
  connectorId: string,
): Promise<string | null> {
  const { data, error } = await (supabaseAdmin.from("app_user_connections") as any)
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey((data as any).connection_key_ciphertext) : null;
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const { error } = await (supabaseAdmin.from("app_user_connections") as any)
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

export async function listUsersWithConnection(connectorId: string): Promise<string[]> {
  const { data, error } = await (supabaseAdmin.from("app_user_connections") as any)
    .select("user_id")
    .eq("connector_id", connectorId);
  if (error) throw error;
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}
