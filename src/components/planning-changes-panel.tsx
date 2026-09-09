import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

type PlanningData = {
  address?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  dates?: string[];
};

type ChangeRow = {
  id: string;
  change_type: "nieuw" | "gewijzigd" | "verdwenen";
  old_data: PlanningData | null;
  new_data: PlanningData | null;
  created_at: string;
  sync_row_id: string;
};

const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });

export function PlanningChangesPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (user) void load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    const { data, error } = await supabase
      .from("planning_changes")
      .select("id,change_type,old_data,new_data,created_at,sync_row_id")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) return;
    setRows((data ?? []) as unknown as ChangeRow[]);
  }

  async function reject(row: ChangeRow) {
    setBusy(row.id);
    const { error } = await supabase.from("planning_changes").update({ status: "afgewezen" }).eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Afgewezen");
    void load();
  }

  async function planDates(projectId: string, dates: string[]) {
    if (!user) return;
    for (const d of dates) {
      await supabase.from("planning_items").insert({
        user_id: user.id,
        project_id: projectId,
        work_date: d,
        end_date: d,
        start_time: "07:00",
        end_time: "17:00",
        employee_ids: [],
        notes: "Automatisch uit Microsoft-planning",
      } as any);
    }
  }

  async function approve(row: ChangeRow) {
    if (!user) return;
    setBusy(row.id);
    try {
      const { data: syncRow, error: srErr } = await supabase
        .from("planning_sync_rows").select("id, project_id").eq("id", row.sync_row_id).maybeSingle();
      if (srErr) throw srErr;

      if (row.change_type === "nieuw") {
        const d = row.new_data ?? {};
        const { data: cust } = await supabase
          .from("customers").select("id").eq("user_id", user.id).ilike("name", "%vlassak%").limit(1).maybeSingle();
        if (!cust) throw new Error("Klant 'Vlassak B.V.' niet gevonden.");
        const { data: number, error: numErr } = await supabase.rpc("next_quote_number");
        if (numErr || !number) throw numErr ?? new Error("Projectnummer ophalen mislukt");
        const { data: p, error: pe } = await supabase.from("projects").insert({
          user_id: user.id,
          project_number: number as string,
          title: d.address || (number as string),
          customer_id: cust.id,
          status: "in_uitvoering",
          location_address: d.address ?? null,
          location_postal_code: d.postal_code ?? null,
          location_city: d.city ?? null,
          location_phone: d.phone ?? null,
        }).select("id").single();
        if (pe) throw pe;
        await planDates(p.id, d.dates ?? []);
        await supabase.from("planning_sync_rows").update({ project_id: p.id }).eq("id", row.sync_row_id);
      } else if (row.change_type === "gewijzigd") {
        const d = row.new_data ?? {};
        const projectId = (syncRow as any)?.project_id as string | null;
        if (projectId) {
          await supabase.from("projects").update({
            location_address: d.address ?? null,
            location_postal_code: d.postal_code ?? null,
            location_city: d.city ?? null,
            location_phone: d.phone ?? null,
          }).eq("id", projectId);
          await supabase.from("planning_items").delete().eq("project_id", projectId);
          await planDates(projectId, d.dates ?? []);
        }
      } else if (row.change_type === "verdwenen") {
        const projectId = (syncRow as any)?.project_id as string | null;
        if (projectId) {
          await supabase.from("projects").update({ status: "geannuleerd" }).eq("id", projectId);
        }
      }

      const { error } = await supabase.from("planning_changes").update({ status: "goedgekeurd" }).eq("id", row.id);
      if (error) throw error;
      toast.success("Goedgekeurd");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Goedkeuren mislukt");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Planning-wijzigingen ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {rows.map((row) => {
            const d = row.new_data ?? row.old_data ?? {};
            const old = row.old_data ?? {};
            return (
              <div key={row.id} className="w-full shrink-0 snap-start rounded-lg border p-3 sm:w-[360px]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={row.change_type === "verdwenen" ? "destructive" : "secondary"}>
                    {row.change_type === "nieuw" ? "Nieuw" : row.change_type === "gewijzigd" ? "Gewijzigd" : "Verdwenen"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("nl-NL")}
                  </span>
                </div>
                <p className="font-semibold">{d.address || "Onbekend adres"}</p>
                <p className="text-sm text-muted-foreground">
                  {[d.postal_code, d.city].filter(Boolean).join("  ")}
                </p>
                {d.phone ? <p className="text-sm text-muted-foreground">Tel: {d.phone}</p> : null}
                <p className="mt-2 text-sm">
                  {row.change_type === "verdwenen"
                    ? "Staat niet meer in de planning — project wordt geannuleerd."
                    : `Werkdagen: ${(d.dates ?? []).map(fmt).join(", ") || "geen"}`}
                </p>
                {row.change_type === "gewijzigd" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Was: {(old.dates ?? []).map(fmt).join(", ") || "geen"}
                    {old.phone && old.phone !== d.phone ? ` · tel. was ${old.phone}` : ""}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve(row)} disabled={busy === row.id}>
                    <Check className="mr-1 h-4 w-4" /> Goedkeuren
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(row)} disabled={busy === row.id}>
                    <X className="mr-1 h-4 w-4" /> Afwijzen
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
