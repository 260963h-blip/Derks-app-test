import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getQuoteByToken = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { token?: string };
    if (!d?.token || typeof d.token !== "string") throw new Error("token required");
    return { token: d.token };
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("quotes")
      .select("id,quote_number,status,total,approved_at,project_id")
      .eq("approval_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const approveQuoteByToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { token?: string };
    if (!d?.token || typeof d.token !== "string") throw new Error("token required");
    return { token: d.token };
  })
  .handler(async ({ data }) => {
    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from("quotes")
      .update({ status: "akkoord", approved_at: now })
      .eq("approval_token", data.token)
      .is("approved_at", null)
      .select("id,project_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (updated?.project_id) {
      await supabaseAdmin
        .from("projects")
        .update({ status: "akkoord" })
        .eq("id", updated.project_id);
    }
    return { ok: true, approved_at: now };
  });