import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/offertes/")({
  component: OffertesPage,
});

type Quote = {
  id: string;
  quote_number: string;
  quote_date: string;
  status: string;
  total: number;
  customer_id: string | null;
  customer_name?: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

function OffertesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    const { data, error } = await supabase
      .from("quotes")
      .select("id,quote_number,quote_date,status,total,customer_id")
      .order("created_at", { ascending: false });
    if (error) return toast.error("Laden mislukt: " + error.message);
    const rows = (data ?? []) as Quote[];
    const ids = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: cs } = await supabase.from("customers").select("id,name").in("id", ids);
      const map = new Map((cs ?? []).map((c) => [c.id, c.name]));
      rows.forEach((r) => (r.customer_name = r.customer_id ? map.get(r.customer_id) ?? null : null));
    }
    setQuotes(rows);
  };

  const newQuote = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data: cs } = await supabase
        .from("company_settings")
        .select("quote_number_year,quote_number_next,default_quote_validity_days")
        .eq("user_id", user.id)
        .maybeSingle();
      const year = cs?.quote_number_year ?? new Date().getFullYear();
      const next = cs?.quote_number_next ?? 1;
      const number = `${year}-${String(next).padStart(4, "0")}`;
      const validity = cs?.default_quote_validity_days ?? 30;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Number(validity));

      const { data: q, error } = await supabase
        .from("quotes")
        .insert({
          user_id: user.id,
          quote_number: number,
          quote_date: new Date().toISOString().slice(0, 10),
          valid_until: validUntil.toISOString().slice(0, 10),
          status: "concept",
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("company_settings")
        .update({ quote_number_next: next + 1 })
        .eq("user_id", user.id);

      navigate({ to: "/offertes/$id", params: { id: q.id } });
    } catch (e: any) {
      toast.error("Aanmaken mislukt: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const removeQuote = async (id: string) => {
    if (!confirm("Offerte verwijderen?")) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (authLoading || !user) return null;

  return (
    <AppShell title="Offertes" subtitle="Offertes aanmaken en beheren" back>
      <div className="mb-4 flex justify-end">
        <Button onClick={newQuote} disabled={creating}>
          <Plus className="mr-1 h-4 w-4" /> {creating ? "Aanmaken..." : "Nieuwe offerte"}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen offertes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">
                      <Link to="/offertes/$id" params={{ id: q.id }} className="text-primary hover:underline">
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>{q.quote_date}</TableCell>
                    <TableCell>{q.customer_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{q.status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(q.total))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate({ to: "/offertes/$id", params: { id: q.id } })}
                          title="Bewerken"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeQuote(q.id)} title="Verwijderen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}