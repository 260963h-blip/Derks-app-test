import { createServerFn } from "@tanstack/react-start";
import { createManagedUser, updateManagedUserPassword } from "@/lib/user-accounts.server";

type CreateInput = { email: string; password: string; accessToken: string };

function validate(input: unknown): CreateInput {
  const data = input as Partial<CreateInput> | undefined;
  const email = (data?.email ?? "").trim().toLowerCase();
  const password = data?.password ?? "";
  const accessToken = (data?.accessToken ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ongeldig e-mailadres");
  }
  if (password.length < 6) {
    throw new Error("Wachtwoord moet minimaal 6 tekens zijn");
  }
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in.");
  }
  return { email, password, accessToken };
}

export const createUserAccount = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    return createManagedUser(data);
  });

type UpdateInput = { user_id: string; password: string; accessToken: string };

function validateUpdate(input: unknown): UpdateInput {
  const data = input as Partial<UpdateInput> | undefined;
  const user_id = (data?.user_id ?? "").trim();
  const password = data?.password ?? "";
  const accessToken = (data?.accessToken ?? "").trim();
  if (!user_id) throw new Error("Ontbrekende gebruiker");
  if (password.length < 6) throw new Error("Wachtwoord moet minimaal 6 tekens zijn");
  if (!accessToken) throw new Error("Je sessie is verlopen. Log opnieuw in.");
  return { user_id, password, accessToken };
}

export const updateUserPassword = createServerFn({ method: "POST" })
  .inputValidator(validateUpdate)
  .handler(async ({ data }) => {
    return updateManagedUserPassword(data);
  });