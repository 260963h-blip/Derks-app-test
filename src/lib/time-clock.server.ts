import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function requireUser(accessToken: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Authenticatieconfiguratie ontbreekt op de server.");
  }
  if (!accessToken.trim()) throw new Error("Je sessie is verlopen. Log opnieuw in.");
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Je sessie is verlopen. Log opnieuw in.");
  return data.user;
}

async function findCompanyByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("user_id,company_name")
    .eq("clock_qr_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findEmployee(userId: string, email: string | undefined, ownerUserId: string) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (normalized) {
    const { data } = await supabaseAdmin
      .from("employees")
      .select("id,first_name,last_name,user_id,email")
      .eq("user_id", ownerUserId)
      .ilike("email", normalized)
      .maybeSingle();
    if (data) return data;
  }
  // De eigenaar zelf mag ook klokken.
  if (userId === ownerUserId) {
    const { data } = await supabaseAdmin
      .from("employees")
      .select("id,first_name,last_name,user_id,email")
      .eq("user_id", ownerUserId)
      .eq("role", "eigenaar")
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

export type ClockState = {
  company: { name: string } | null;
  employee: { id: string; name: string } | null;
  openEntry: { id: string; clock_in_at: string } | null;
  error?: string;
};

async function loadOpenEntry(ownerUserId: string, employeeId: string) {
  const { data } = await supabaseAdmin
    .from("time_clock_entries")
    .select("id,clock_in_at")
    .eq("user_id", ownerUserId)
    .eq("employee_id", employeeId)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, clock_in_at: data.clock_in_at } : null;
}

export async function getClockState(input: { token: string; accessToken: string }): Promise<ClockState> {
  const user = await requireUser(input.accessToken);
  const company = await findCompanyByToken(input.token);
  if (!company) {
    return { company: null, employee: null, openEntry: null, error: "Deze QR-code is niet geldig" };
  }

  const employee = await findEmployee(user.id, user.email, company.user_id);
  if (!employee) {
    return {
      company: { name: company.company_name },
      employee: null,
      openEntry: null,
      error: "Je account is niet gekoppeld aan een medewerker.",
    };
  }

  return {
    company: { name: company.company_name },
    employee: { id: employee.id, name: `${employee.first_name} ${employee.last_name}` },
    openEntry: await loadOpenEntry(company.user_id, employee.id),
  };
}

export async function clockIn(input: { token: string; accessToken: string }) {
  const state = await getClockState(input);
  if (state.error || !state.company || !state.employee) {
    throw new Error(state.error ?? "Klokken niet mogelijk.");
  }
  if (state.openEntry) throw new Error("Je bent al ingeklokt.");

  const company = await findCompanyByToken(input.token);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("time_clock_entries").insert({
    user_id: company!.user_id,
    employee_id: state.employee.id,
    project_id: null,
    clock_in_at: now,
  });
  if (error) throw new Error(error.message);
  return { at: now };
}

function toTime(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

export async function clockOut(input: { token: string; accessToken: string }) {
  const state = await getClockState(input);
  if (!state.employee) throw new Error(state.error ?? "Klokken niet mogelijk.");
  if (!state.openEntry) throw new Error("Je bent niet ingeklokt.");

  const company = await findCompanyByToken(input.token);
  const ownerUserId = company!.user_id;
  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("time_clock_entries")
    .update({ clock_out_at: now })
    .eq("id", state.openEntry.id)
    .select("id,employee_id,clock_in_at,clock_out_at")
    .single();
  if (error) throw new Error(error.message);

  // Zet de geklokte tijd door naar het bestaande urenoverzicht (zelfde goedkeuringsflow).
  const start = new Date(updated.clock_in_at);
  const end = new Date(now);
  const hours = Math.max(0, Math.round(((end.getTime() - start.getTime()) / 3600000) * 100) / 100);

  await supabaseAdmin.from("time_entries").insert({
    user_id: ownerUserId,
    employee_id: updated.employee_id,
    work_date: updated.clock_in_at.slice(0, 10),
    start_time: toTime(updated.clock_in_at),
    end_time: toTime(now),
    break_minutes: 0,
    hours,
    entry_type: "regulier",
    description: "Geklokt via QR-code",
    status: "ingediend",
  });

  return { at: now, hours };
}
