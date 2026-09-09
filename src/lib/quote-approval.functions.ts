import { createServerFn } from "@tanstack/react-start";

type TokenInput = { token: string };

function validateToken(input: TokenInput): TokenInput {
  const token = typeof input?.token === "string" ? input.token.trim() : "";
  if (token.length < 16 || token.length > 200 || !/^[A-Za-z0-9._-]+$/.test(token)) {
    throw new Error("Ongeldige link.");
  }
  return { token };
}

/** Public: read the minimal quote details behind a valid approval token. */
export const getQuoteByApprovalToken = createServerFn({ method: "POST" })
  .inputValidator(validateToken)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin
      .from("quotes")
      .select("id,quote_number,status,total,approved_at")
      .eq("approval_token", data.token)
      .maybeSingle();
    if (error || !quote) throw new Error("Deze offerte kon niet worden gevonden.");
    return {
      quote_number: quote.quote_number as string,
      status: quote.status as string,
      total: Number(quote.total ?? 0),
      approved_at: (quote.approved_at as string | null) ?? null,
    };
  });

/** Public: register approval for the quote that matches this exact token. */
export const approveQuoteByApprovalToken = createServerFn({ method: "POST" })
  .inputValidator(validateToken)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin
      .from("quotes")
      .select("id,status,approved_at")
      .eq("approval_token", data.token)
      .maybeSingle();
    if (error || !quote) throw new Error("Deze offerte kon niet worden gevonden.");
    if (quote.approved_at || quote.status === "akkoord") return { ok: true, alreadyApproved: true };

    const { error: updErr } = await supabaseAdmin
      .from("quotes")
      .update({ status: "akkoord", approved_at: new Date().toISOString() })
      .eq("id", quote.id)
      .eq("approval_token", data.token);
    if (updErr) throw new Error("Akkoord registreren mislukt.");
    return { ok: true, alreadyApproved: false };
  });
