import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/instellingen")({
  component: InstellingenPage,
});

type Category = { id: string; scope: "materiaal" | "werkzaamheid"; name: string; sort_order: number };
type Unit = { id: string; code: string; label: string; sort_order: number };
type Numbering = {
  quote_number_year: number;
  quote_number_next: number;
  invoice_number_year: number;
  invoice_number_next: number;
};

function InstellingenPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newCat, setNewCat] = useState<{ materiaal: string; werkzaamheid: string }>({ materiaal: "", werkzaamheid: "" });
  const [newUnit, setNewUnit] = useState<{ code: string; label: string }>({ code: "", label: "" });
  const [numbering, setNumbering] = useState<Numbering>({
    quote_number_year: new Date().getFullYear(),
    quote_number_next: 1,
    invoice_number_year: new Date().getFullYear(),
    invoice_number_next: 1,
  });
  const [savingNum, setSavingNum] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const [c, u] = await Promise.all([
      supabase.from("article_categories").select("*").order("sort_order").order("name"),
      supabase.from("article_units").select("*").order("sort_order").order("label"),
    ]);
    if (c.error) toast.error("Categorieën laden mislukt: " + c.error.message);
    else setCats((c.data ?? []) as Category[]);
    if (u.error) toast.error("Eenheden laden mislukt: " + u.error.message);
    else setUnits((u.data ?? []) as Unit[]);
    if (user) {
      const { data } = await supabase
        .from("company_settings")
        .select("quote_number_year,quote_number_next,invoice_number_year,invoice_number_next")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setNumbering({
          quote_number_year: data.quote_number_year ?? new Date().getFullYear(),
          quote_number_next: data.quote_number_next ?? 1,
          invoice_number_year: data.invoice_number_year ?? new Date().getFullYear(),
          invoice_number_next: data.invoice_number_next ?? 1,
        });
      }
    }
  };

  const addCat = async (scope: "materiaal" | "werkzaamheid") => {
    if (!user) return;
    const name = newCat[scope].trim();
    if (!name) return;
    const { error } = await supabase.from("article_categories").insert({ user_id: user.id, scope, name });
    if (error) return toast.error(error.message);
    setNewCat({ ...newCat, [scope]: "" });
    load();
  };

  const delCat = async (id: string) => {
    const { error } = await supabase.from("article_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addUnit = async () => {
    if (!user) return;
    const code = newUnit.code.trim();
    const label = newUnit.label.trim() || code;
    if (!code) return;
    const { error } = await supabase.from("article_units").insert({ user_id: user.id, code, label });
    if (error) return toast.error(error.message);
    setNewUnit({ code: "", label: "" });
    load();
  };

  const delUnit = async (id: string) => {
    const { error } = await supabase.from("article_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const saveNumbering = async () => {
    if (!user) return;
    setSavingNum(true);
    const { data: existing } = await supabase
      .from("company_settings")
      .select("id, company_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const payload = {
      user_id: user.id,
      company_name: existing?.company_name ?? "",
      quote_number_year: numbering.quote_number_year,
      quote_number_next: numbering.quote_number_next,
      invoice_number_year: numbering.invoice_number_year,
      invoice_number_next: numbering.invoice_number_next,
    };
    const { error } = await supabase
      .from("company_settings")
      .upsert(payload, { onConflict: "user_id" });
    setSavingNum(false);
    if (error) toast.error("Opslaan mislukt: " + error.message);
    else toast.success("Nummering opgeslagen");
  };

  const pad4 = (n: number) => String(Math.max(0, n)).padStart(4, "0");

  if (authLoading || !user) return null;

  return (
    <AppShell title="Instellingen">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Instellingen</h1>
          <p className="text-muted-foreground">Beheer je categorieën en eenheden voor artikelen</p>
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">Categorieën</TabsTrigger>
            <TabsTrigger value="units">Eenheden</TabsTrigger>
            <TabsTrigger value="numbering">Nummering</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4 space-y-4">
            {(["materiaal", "werkzaamheid"] as const).map((scope) => (
              <Card key={scope}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {scope === "materiaal" ? "Materiaal-categorieën" : "Werkzaamheid-ruimtes"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex gap-2">
                    <Input
                      placeholder={scope === "materiaal" ? "bv. Verf, Behang, Voorstrijk" : "bv. Keuken, Badkamer"}
                      value={newCat[scope]}
                      onChange={(e) => setNewCat({ ...newCat, [scope]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addCat(scope)}
                    />
                    <Button onClick={() => addCat(scope)}>
                      <Plus className="mr-1 h-4 w-4" /> Toevoegen
                    </Button>
                  </div>
                  {cats.filter((c) => c.scope === scope).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nog geen categorieën.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Naam</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cats.filter((c) => c.scope === scope).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => delCat(c.id)}>
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
            ))}
          </TabsContent>

          <TabsContent value="units" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Eenheden</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-3 grid grid-cols-[1fr_2fr_auto] gap-2">
                  <div>
                    <Label className="text-xs">Code</Label>
                    <Input
                      placeholder="stuk"
                      value={newUnit.code}
                      onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Label (weergave)</Label>
                    <Input
                      placeholder="per stuk"
                      value={newUnit.label}
                      onChange={(e) => setNewUnit({ ...newUnit, label: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addUnit()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addUnit}>
                      <Plus className="mr-1 h-4 w-4" /> Toevoegen
                    </Button>
                  </div>
                </div>
                {units.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nog geen eenheden.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-xs">{u.code}</TableCell>
                          <TableCell>{u.label}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => delUnit(u.id)}>
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
          </TabsContent>

          <TabsContent value="numbering" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Offertenummering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Jaar</Label>
                    <Input
                      type="number"
                      value={numbering.quote_number_year}
                      onChange={(e) =>
                        setNumbering({ ...numbering, quote_number_year: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Volgend nummer</Label>
                    <Input
                      type="number"
                      value={numbering.quote_number_next}
                      onChange={(e) =>
                        setNumbering({ ...numbering, quote_number_next: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Volgende offerte: <span className="font-mono">{numbering.quote_number_year}-{pad4(numbering.quote_number_next)}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factuurnummering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Jaar</Label>
                    <Input
                      type="number"
                      value={numbering.invoice_number_year}
                      onChange={(e) =>
                        setNumbering({ ...numbering, invoice_number_year: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Volgend nummer</Label>
                    <Input
                      type="number"
                      value={numbering.invoice_number_next}
                      onChange={(e) =>
                        setNumbering({ ...numbering, invoice_number_next: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Volgende factuur: <span className="font-mono">{numbering.invoice_number_year}-{pad4(numbering.invoice_number_next)}</span>
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveNumbering} disabled={savingNum}>
                {savingNum ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
