import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CreateInput = { email: string; password: string };

function validate(input: unknown): CreateInput {
  const data = input as Partial<CreateInput> | undefined;
  const email = (data?.email ?? "").trim().toLowerCase();
  const password = data?.password ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ongeldig e-mailadres");
  }
  if (password.length < 6) {
    throw new Error("Wachtwoord moet minimaal 6 tekens zijn");
  }
  return { email, password };
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { id: created.user?.id, email: created.user?.email };
  });

type UpdateInput = { user_id: string; password: string };

function validateUpdate(input: unknown): UpdateInput {
  const data = input as Partial<UpdateInput> | undefined;
  const user_id = (data?.user_id ?? "").trim();
  const password = data?.password ?? "";
  if (!user_id) throw new Error("Ontbrekende gebruiker");
  if (password.length < 6) throw new Error("Wachtwoord moet minimaal 6 tekens zijn");
  return { user_id, password };
}

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateUpdate)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });