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

async function findProjectByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,user_id,project_number,title,location_address,location_city")
    .eq("qr_token", token)
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
  // De eigenaar zelf mag ook klokken op zijn eigen projecten.
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
  project: { id: string; title: string; number: string; address: string | null } | null;
  employee: { id: string; name: string } | null;
  openEntry: { id: string; clock_in_at: string; project_title: string } | null;
  error?: string;
};

async function loadOpenEntry(ownerUserId: string, employeeId: string) {
  const { data } = await supabaseAdmin
    .from("time_clock_entries")
    .select("id,clock_in_at,project_id")
    .eq("user_id", ownerUserId)
    .eq("employee_id", employeeId)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: proj } = await supabaseAdmin
    .from("projects")
    .select("title")
    .eq("id", data.project_id)
    .maybeSingle();
  return {
    id: data.id,
    clock_in_at: data.clock_in_at,
    project_title: proj?.title ?? "onbekend project",
  };
}

export async function getClockState(input: { token: string; accessToken: string }): Promise<ClockState> {
  const user = await requireUser(input.accessToken);
  const project = await findProjectByToken(input.token);
  if (!project) return { project: null, employee: null, openEntry: null, error: "Deze QR-code is niet geldig" };

  const employee = await findEmployee(user.id, user.email, project.user_id);
  if (!employee) {
    return {
      project: {
        id: project.id,
        title: project.title,
        number: project.project_number,
        address: project.location_address
          ? `${project.location_address}${project.location_city ? `, ${project.location_city}` : ""}`
          : null,
      },
      employee: null,
      openEntry: null,
      error: "Je account is niet gekoppeld aan een medewerker.",
    };
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      number: project.project_number,
      address: project.location_address
        ? `${project.location_address}${project.location_city ? `, ${project.location_city}` : ""}`
        : null,
    },
    employee: { id: employee.id, name: `${employee.first_name} ${employee.last_name}` },
    openEntry: await loadOpenEntry(project.user_id, employee.id),
  };
}

export async function clockIn(input: { token: string; accessToken: string }) {
  const state = await getClockState(input);
  if (state.error || !state.project || !state.employee) {
    throw new Error(state.error ?? "Klokken niet mogelijk.");
  }
  if (state.openEntry) throw new Error("Je bent al ingeklokt.");

  const project = await findProjectByToken(input.token);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("time_clock_entries").insert({
    user_id: project!.user_id,
    employee_id: state.employee.id,
    project_id: state.project.id,
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

  const project = await findProjectByToken(input.token);
  const ownerUserId = project!.user_id;
  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("time_clock_entries")
    .update({ clock_out_at: now })
    .eq("id", state.openEntry.id)
    .select("id,employee_id,project_id,clock_in_at,clock_out_at")
    .single();
  if (error) throw new Error(error.message);

  // Zet de geklokte tijd door naar het bestaande urenoverzicht (zelfde goedkeuringsflow).
  const { data: proj } = await supabaseAdmin
    .from("projects")
    .select("title,project_number,customer_id")
    .eq("id", updated.project_id)
    .maybeSingle();

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
    customer_id: proj?.customer_id ?? null,
    project: proj ? `${proj.project_number} ${proj.title}` : null,
    description: "Geklokt via QR-code",
    status: "ingediend",
  });

  return { at: now, hours };
}
