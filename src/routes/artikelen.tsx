import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/artikelen")({
  component: ArtikelenPage,
});

type FieldType = "number" | "text" | "select" | "boolean";
type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
};

type Article = {
  id: string;
  article_type: "materiaal" | "werkzaamheid";
  category: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  unit: string;
  unit_label: string | null;
  vat_rate: number;
  price: number;
  cost_price: number | null;
  field_schema: FieldDef[];
  is_active: boolean;
};

const MATERIAL_SUBCATS = ["Hoekstukken", "Zakken stuc", "Voorstrijk", "Verf", "Behang", "Overig"];
const ROOMS = ["Keuken", "Woonkamer", "Slaapkamer", "Badkamer", "Hal/Gang", "Toilet", "Zolder", "Overig"];
const UNITS = ["stuk", "zak", "liter", "rol", "m2", "m1", "wand", "uur", "ja_nee", "set"];

const emptyForm = (type: "materiaal" | "werkzaamheid") => ({
  article_type: type,
  category: type === "materiaal" ? "Materialen" : "",
  subcategory: "",
  name: "",
  description: "",
  unit: type === "materiaal" ? "stuk" : "m2",
  unit_label: "",
  vat_rate: type === "materiaal" ? 21 : 9,
  price: 0,
  cost_price: null as number | null,
  field_schema: [] as FieldDef[],
  is_active: true,
});

function ArtikelenPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"materiaal" | "werkzaamheid">("materiaal");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("alle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm("materiaal"));

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) toast.error("Laden mislukt: " + error.message);
    else setArticles((data ?? []) as unknown as Article[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return articles
      .filter((a) => a.article_type === tab)
      .filter((a) => filterCat === "alle" || (tab === "materiaal" ? a.subcategory === filterCat : a.category === filterCat))
      .filter((a) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          (a.subcategory ?? "").toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        );
      });
  }, [articles, tab, filterCat, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm(tab));
    setDialogOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setForm({
      article_type: a.article_type,
      category: a.category,
      subcategory: a.subcategory ?? "",
      name: a.name,
      description: a.description ?? "",
      unit: a.unit,
      unit_label: a.unit_label ?? "",
      vat_rate: Number(a.vat_rate),
      price: Number(a.price),
      cost_price: a.cost_price !== null ? Number(a.cost_price) : null,
      field_schema: Array.isArray(a.field_schema) ? a.field_schema : [],
      is_active: a.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Naam is verplicht");
    if (!form.category.trim()) return toast.error(tab === "werkzaamheid" ? "Ruimte is verplicht" : "Categorie is verplicht");

    const payload = {
      user_id: user.id,
      article_type: form.article_type,
      category: form.category.trim(),
      subcategory: form.subcategory.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit,
      unit_label: form.unit_label.trim() || null,
      vat_rate: Number(form.vat_rate),
      price: Number(form.price) || 0,
      cost_price: form.cost_price !== null && !Number.isNaN(form.cost_price) ? Number(form.cost_price) : null,
      field_schema: form.field_schema as unknown as never,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from("articles").update(payload).eq("id", editing.id);
      if (error) return toast.error("Opslaan mislukt: " + error.message);
      toast.success("Artikel bijgewerkt");
    } else {
      const { error } = await supabase.from("articles").insert(payload);
      if (error) return toast.error("Opslaan mislukt: " + error.message);
      toast.success("Artikel toegevoegd");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("articles").delete().eq("id", deleteId);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Verwijderd");
      load();
    }
    setDeleteId(null);
  };

  // Field schema helpers
  const addField = () => {
    setForm((f) => ({
      ...f,
      field_schema: [...f.field_schema, { key: "", label: "", type: "number" as FieldType }],
    }));
  };
  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    setForm((f) => ({
      ...f,
      field_schema: f.field_schema.map((fd, i) => (i === idx ? { ...fd, ...patch } : fd)),
    }));
  };
  const removeField = (idx: number) => {
    setForm((f) => ({ ...f, field_schema: f.field_schema.filter((_, i) => i !== idx) }));
  };

  if (authLoading || !user) return null;

  const filterOptions = tab === "materiaal" ? MATERIAL_SUBCATS : ROOMS;

  return (
    <AppShell title="Artikelen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Artikelen</h1>
            <p className="text-muted-foreground">Materialen en werkzaamheden beheren</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nieuw
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "materiaal" | "werkzaamheid"); setFilterCat("alle"); }}>
          <TabsList>
            <TabsTrigger value="materiaal">Materialen</TabsTrigger>
            <TabsTrigger value="werkzaamheid">Werkzaamheden</TabsTrigger>
          </TabsList>

          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Zoeken..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={tab === "materiaal" ? "Subcategorie" : "Ruimte"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle</SelectItem>
                    {filterOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="materiaal" className="m-0">
                <ArticleTable
                  loading={loading}
                  rows={filtered}
                  type="materiaal"
                  onEdit={openEdit}
                  onDelete={setDeleteId}
                />
              </TabsContent>
              <TabsContent value="werkzaamheid" className="m-0">
                <ArticleTable
                  loading={loading}
                  rows={filtered}
                  type="werkzaamheid"
                  onEdit={openEdit}
                  onDelete={setDeleteId}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Artikel bewerken" : "Nieuw artikel"} —{" "}
              {form.article_type === "materiaal" ? "Materiaal" : "Werkzaamheid"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {form.article_type === "materiaal" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Subcategorie</Label>
                  <Select
                    value={form.subcategory || undefined}
                    onValueChange={(v) => setForm({ ...form, subcategory: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Kies..." /></SelectTrigger>
                    <SelectContent>
                      {MATERIAL_SUBCATS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>BTW (%)</Label>
                  <Input
                    type="number"
                    value={form.vat_rate}
                    onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ruimte</Label>
                  <Select
                    value={ROOMS.includes(form.category) ? form.category : undefined}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Kies of typ..." /></SelectTrigger>
                    <SelectContent>
                      {ROOMS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    placeholder="of vrije ruimtenaam"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>BTW (%)</Label>
                  <Input
                    type="number"
                    value={form.vat_rate}
                    onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.article_type === "materiaal" ? "bv. Hoekprofiel 2m" : "bv. Stukadoren wanden"}
              />
            </div>

            <div>
              <Label>Omschrijving</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Eenheid</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Eenheidslabel (weergave)</Label>
                <Input
                  value={form.unit_label}
                  onChange={(e) => setForm({ ...form, unit_label: e.target.value })}
                  placeholder="bv. per zak (25kg)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Verkoopprijs (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Inkoopprijs (€) — optioneel</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost_price ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, cost_price: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
            </div>

            {form.article_type === "werkzaamheid" && (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-semibold">Extra invoervelden (bij offerte/calculatie)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addField}>
                    <Plus className="mr-1 h-3 w-3" /> Veld
                  </Button>
                </div>
                {form.field_schema.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nog geen velden. Voeg bv. "Aantal wanden", "Hoogte (m)", "Kleur", "Type stucwerk" toe.
                  </p>
                )}
                <div className="space-y-2">
                  {form.field_schema.map((fd, i) => (
                    <div key={i} className="grid grid-cols-12 items-end gap-2 rounded border p-2">
                      <div className="col-span-3">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={fd.label}
                          onChange={(e) => updateField(i, { label: e.target.value })}
                          placeholder="Aantal wanden"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Sleutel</Label>
                        <Input
                          value={fd.key}
                          onChange={(e) => updateField(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                          placeholder="aantal_wanden"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={fd.type}
                          onValueChange={(v) => updateField(i, { type: v as FieldType })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">Getal</SelectItem>
                            <SelectItem value="text">Tekst</SelectItem>
                            <SelectItem value="select">Keuzelijst</SelectItem>
                            <SelectItem value="boolean">Ja/Nee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Opties (komma)</Label>
                        <Input
                          disabled={fd.type !== "select"}
                          value={(fd.options ?? []).join(",")}
                          onChange={(e) =>
                            updateField(i, {
                              options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="glad,structuur"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeField(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={save}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Artikel verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze actie kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function ArticleTable({
  loading,
  rows,
  type,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  rows: Article[];
  type: "materiaal" | "werkzaamheid";
  onEdit: (a: Article) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Laden...</p>;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Geen artikelen gevonden.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === "materiaal" ? "Subcategorie" : "Ruimte"}</TableHead>
          <TableHead>Naam</TableHead>
          <TableHead>Eenheid</TableHead>
          <TableHead className="text-right">Prijs</TableHead>
          <TableHead>BTW</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{type === "materiaal" ? (a.subcategory ?? "—") : a.category}</TableCell>
            <TableCell className="font-medium">
              {a.name}
              {!a.is_active && <Badge variant="outline" className="ml-2">inactief</Badge>}
            </TableCell>
            <TableCell>{a.unit_label || a.unit}</TableCell>
            <TableCell className="text-right">€ {Number(a.price).toFixed(2)}</TableCell>
            <TableCell>{Number(a.vat_rate)}%</TableCell>
            <TableCell className="text-right">
              <Button size="icon" variant="ghost" onClick={() => onEdit(a)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onDelete(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
