import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/offertes/$id")({
  component: OfferteEditor,
});

type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  status: string;
  quote_date: string;
  valid_until: string | null;
  notes: string | null;
};

type Line = {
  id: string;
  line_type: "artikel" | "medewerker" | "ruimte";
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  sort_order: number;
};

type Customer = { id: string; name: string };
type Article = { id: string; name: string; price: number; vat_rate: number; unit: string | null; unit_label: string | null };
type Employee = { id: string; first_name: string; last_name: string; role: string };
type Rate = { id: string; employee_id: string; name: string; hourly_rate: number; is_default: boolean };
type Room = { id: string; name: string; price_per_m2: number; vat_rate: number; default_m2: number | null };

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

function OfferteEditor() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [pickArticle, setPickArticle] = useState<string>("");
  const [pickEmployee, setPickEmployee] = useState<string>("");
  const [pickRate, setPickRate] = useState<string>("");
  const [empHours, setEmpHours] = useState<string>("1");
  const [pickRoom, setPickRoom] = useState<string>("");
  const [roomM2, setRoomM2] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const load = async () => {
    const [{ data: q, error: qe }, { data: ls }, { data: cs }, { data: arts }, { data: emps }, { data: rs }, { data: rms }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
      supabase.from("quote_lines").select("*").eq("quote_id", id).order("sort_order"),
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("articles").select("id,name,price,vat_rate,unit,unit_label").eq("is_active", true).order("name"),
      supabase.from("employees").select("id,first_name,last_name,role").order("first_name"),
      supabase.from("employee_rates").select("id,employee_id,name,hourly_rate,is_default").order("sort_order"),
      supabase.from("rooms").select("id,name,price_per_m2,vat_rate,default_m2").eq("is_active", true).order("sort_order").order("name"),
    ]);
    if (qe || !q) {
      toast.error("Offerte niet gevonden");
      navigate({ to: "/offertes" });
      return;
    }
    setQuote(q as Quote);
    setLines((ls ?? []) as Line[]);
    setCustomers((cs ?? []) as Customer[]);
    setArticles((arts ?? []) as Article[]);
    setEmployees((emps ?? []) as Employee[]);
    setRates((rs ?? []) as Rate[]);
    setRooms((rms ?? []) as Room[]);
  };

  const totals = useMemo(() => {
    let sub = 0;
    let vat = 0;
    for (const l of lines) {
      const lt = Number(l.quantity) * Number(l.unit_price);
      sub += lt;
      vat += (lt * Number(l.vat_rate)) / 100;
    }
    return { sub, vat, total: sub + vat };
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => {
      const copy = [...prev];
      const merged = { ...copy[idx], ...patch };
      merged.line_total = Number(merged.quantity) * Number(merged.unit_price);
      copy[idx] = merged;
      return copy;
    });
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addArticleLine = () => {
    const a = articles.find((x) => x.id === pickArticle);
    if (!a) return;
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        line_type: "artikel",
        description: a.name,
        quantity: 1,
        unit: a.unit_label || a.unit,
        unit_price: Number(a.price),
        vat_rate: Number(a.vat_rate),
        line_total: Number(a.price),
        sort_order: prev.length,
      },
    ]);
    setPickArticle("");
  };

  const employeeRates = useMemo(
    () => rates.filter((r) => r.employee_id === pickEmployee),
    [rates, pickEmployee]
  );

  useEffect(() => {
    const def = employeeRates.find((r) => r.is_default) ?? employeeRates[0];
    setPickRate(def?.id ?? "");
  }, [pickEmployee, employeeRates]);

  const addEmployeeLine = () => {
    const e = employees.find((x) => x.id === pickEmployee);
    const r = rates.find((x) => x.id === pickRate);
    const hrs = Number(empHours) || 0;
    if (!e || !r || hrs <= 0) return;
    const desc = `${e.first_name} ${e.last_name} — ${r.name}`;
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        line_type: "medewerker",
        description: desc,
        quantity: hrs,
        unit: "uur",
        unit_price: Number(r.hourly_rate),
        vat_rate: 21,
        line_total: hrs * Number(r.hourly_rate),
        sort_order: prev.length,
      },
    ]);
    setPickEmployee("");
    setPickRate("");
    setEmpHours("1");
  };

  const addRoomLine = () => {
    const r = rooms.find((x) => x.id === pickRoom);
    const m2 = Number(roomM2) || 0;
    if (!r || m2 <= 0) return;
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        line_type: "ruimte",
        description: r.name,
        quantity: m2,
        unit: "m²",
        unit_price: Number(r.price_per_m2),
        vat_rate: Number(r.vat_rate),
        line_total: m2 * Number(r.price_per_m2),
        sort_order: prev.length,
      },
    ]);
    setPickRoom("");
    setRoomM2("");
  };

  const save = async () => {
    if (!quote || !user) return;
    setSaving(true);
    try {
      const { error: qe } = await supabase
        .from("quotes")
        .update({
          customer_id: quote.customer_id,
          status: quote.status,
          quote_date: quote.quote_date,
          valid_until: quote.valid_until,
          notes: quote.notes,
          subtotal: totals.sub,
          vat_total: totals.vat,
          total: totals.total,
        })
        .eq("id", quote.id);
      if (qe) throw qe;

      await supabase.from("quote_lines").delete().eq("quote_id", quote.id);
      if (lines.length) {
        const payload = lines.map((l, i) => ({
          user_id: user.id,
          quote_id: quote.id,
          line_type: l.line_type,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          vat_rate: l.vat_rate,
          line_total: Number(l.quantity) * Number(l.unit_price),
          sort_order: i,
        }));
        const { error: le } = await supabase.from("quote_lines").insert(payload);
        if (le) throw le;
      }
      toast.success("Offerte opgeslagen");
      load();
    } catch (e: any) {
      toast.error("Opslaan mislukt: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || !quote) return null;

  return (
    <AppShell title={`Offerte ${quote.quote_number}`} subtitle="Stel de offerte samen" back>
      <div className="space-y-6">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Nummer</Label>
              <Input value={quote.quote_number} readOnly className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Datum</Label>
              <Input
                type="date"
                value={quote.quote_date}
                onChange={(e) => setQuote({ ...quote, quote_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Geldig tot</Label>
              <Input
                type="date"
                value={quote.valid_until ?? ""}
                onChange={(e) => setQuote({ ...quote, valid_until: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={quote.status} onValueChange={(v) => setQuote({ ...quote, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="verzonden">Verzonden</SelectItem>
                  <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
                  <SelectItem value="afgewezen">Afgewezen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label className="text-xs">Klant</Label>
              <Select
                value={quote.customer_id ?? undefined}
                onValueChange={(v) => setQuote({ ...quote, customer_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecteer klant..." /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Toevoegen</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Artikel</Label>
              <Select value={pickArticle || undefined} onValueChange={setPickArticle}>
                <SelectTrigger><SelectValue placeholder="Kies artikel..." /></SelectTrigger>
                <SelectContent>
                  {articles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {fmt(Number(a.price))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addArticleLine} disabled={!pickArticle} className="w-full">
                <Plus className="mr-1 h-4 w-4" /> Toevoegen
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Medewerker</Label>
              <Select value={pickEmployee || undefined} onValueChange={setPickEmployee}>
                <SelectTrigger><SelectValue placeholder="Kies medewerker..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} {e.role === "eigenaar" ? "(eigenaar)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickEmployee && (
                <Select value={pickRate || undefined} onValueChange={setPickRate}>
                  <SelectTrigger><SelectValue placeholder="Kies tarief..." /></SelectTrigger>
                  <SelectContent>
                    {employeeRates.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Geen tarieven</div>
                    ) : employeeRates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — {fmt(Number(r.hourly_rate))}/uur
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Uren"
                  value={empHours}
                  onChange={(e) => setEmpHours(e.target.value)}
                />
                <Button size="sm" onClick={addEmployeeLine} disabled={!pickEmployee || !pickRate}>
                  <Plus className="mr-1 h-4 w-4" /> Toevoegen
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Ruimte</Label>
              <Select value={pickRoom || undefined} onValueChange={(v) => {
                setPickRoom(v);
                const r = rooms.find((x) => x.id === v);
                if (r?.default_m2) setRoomM2(String(r.default_m2));
              }}>
                <SelectTrigger><SelectValue placeholder="Kies ruimte..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {fmt(Number(r.price_per_m2))}/m²
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="m²"
                  value={roomM2}
                  onChange={(e) => setRoomM2(e.target.value)}
                />
                <Button size="sm" onClick={addRoomLine} disabled={!pickRoom}>
                  <Plus className="mr-1 h-4 w-4" /> Toevoegen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Regels</CardTitle></CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen regels.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Type</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="w-[90px]">Aantal</TableHead>
                    <TableHead className="w-[60px]">Eenh.</TableHead>
                    <TableHead className="w-[110px]">Prijs</TableHead>
                    <TableHead className="w-[80px]">BTW%</TableHead>
                    <TableHead className="w-[110px] text-right">Totaal</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs uppercase text-muted-foreground">{l.line_type}</TableCell>
                      <TableCell>
                        <Input
                          value={l.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.unit ?? ""}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={l.unit_price}
                          onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={l.vat_rate}
                          onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(Number(l.quantity) * Number(l.unit_price))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="ml-auto max-w-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotaal</span>
                <span>{fmt(totals.sub)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTW</span>
                <span>{fmt(totals.vat)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <span>Totaal</span>
                <span>{fmt(totals.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/offertes" })}>Terug</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}