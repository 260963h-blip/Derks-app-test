import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

function normalizeAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("already") || lowerMessage.includes("exists") || lowerMessage.includes("registered")) {
    return "Voor dit e-mailadres bestaat al een account.";
  }

  return message;
}

async function requireAuthenticatedOperator(accessToken: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Authenticatieconfiguratie ontbreekt op de server.");
  }

  if (!accessToken.trim()) {
    throw new Error("Je sessie is verlopen. Log opnieuw in.");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Je sessie is verlopen. Log opnieuw in.");
  }

  return data.user;
}

export async function createManagedUser(input: {
  email: string;
  password: string;
  accessToken: string;
}) {
  await requireAuthenticatedOperator(input.accessToken);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(normalizeAuthError(error.message));
  }

  return {
    id: data.user?.id,
    email: data.user?.email,
  };
}

export async function updateManagedUserPassword(input: {
  user_id: string;
  password: string;
  accessToken: string;
}) {
  await requireAuthenticatedOperator(input.accessToken);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(input.user_id, {
    password: input.password,
  });

  if (error) {
    throw new Error(normalizeAuthError(error.message));
  }

  return { ok: true };
}