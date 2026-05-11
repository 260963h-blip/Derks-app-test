import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/artikelen")({
  component: ArtikelenPage,
  errorComponent: ({ error, reset }) => {
    // eslint-disable-next-line no-console
    console.error("[artikelen] route error:", error);
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold mb-2">Er ging iets mis op deze pagina</h1>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">
          {String((error as Error)?.stack || (error as Error)?.message || error)}
        </pre>
        <button
          onClick={() => reset()}
          className="mt-3 rounded-md border px-3 py-1 text-sm"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  },
});

type Article = {
  id: string;
  article_type: "materiaal";
  category: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  unit: string;
  unit_label: string | null;
  vat_rate: number;
  price: number;
  cost_price: number | null;
  is_active: boolean;
};

type Room = {
  id: string;
  name: string;
  default_walls: number;
  include_ceiling: boolean;
  default_m2: number | null;
  price_per_m2: number;
  vat_rate: number;
  is_active: boolean;
  pricing_type: "per_m2" | "fixed";
  fixed_price: number;
};

type CategoryRow = { id: string; scope: "materiaal" | "werkzaamheid"; name: string };
type UnitRow = { id: string; code: string; label: string };

type Finish = {
  id: string;
  name: string;
  price_per_m2: number;
  is_active: boolean;
};

const normalize = (v: string | null | undefined) => v?.trim() ?? "";
const uniqueNames = (vals: Array<string | null | undefined>) =>
  Array.from(new Set(vals.map(normalize).filter(Boolean)));
const normalizeUnits = (rows: UnitRow[]) => {
  const seen = new Set<string>();
  return rows.reduce<UnitRow[]>((acc, r) => {
    const code = normalize(r.code);
    if (!code || seen.has(code)) return acc;
    seen.add(code);
    acc.push({ ...r, code, label: normalize(r.label) || code });
    return acc;
  }, []);
};

const emptyMaterial = (defaultVat = 21) => ({
  category: "Materialen",
  subcategory: "",
  name: "",
  description: "",
  unit: "",
  unit_label: "",
  vat_rate: defaultVat,
  price: 0,
  cost_price: null as number | null,
  is_active: true,
});

const emptyRoom = () => ({
  name: "",
  default_walls: 4,
  include_ceiling: false,
  default_m2: null as number | null,
  price_per_m2: 0,
  vat_rate: 9,
  is_active: true,
  pricing_type: "per_m2" as "per_m2" | "fixed",
  fixed_price: 0,
});

const emptyFinish = () => ({
  name: "",
  price_per_m2: 0,
  is_active: true,
});

function ArtikelenPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"materiaal" | "ruimte" | "afwerking">("materiaal");

  const [articles, setArticles] = useState<Article[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [defaultVat, setDefaultVat] = useState<number>(21);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("alle");

  const [matDialog, setMatDialog] = useState(false);
  const [matEditing, setMatEditing] = useState<Article | null>(null);
  const [matForm, setMatForm] = useState(emptyMaterial());
  const [delMat, setDelMat] = useState<string | null>(null);

  const [roomDialog, setRoomDialog] = useState(false);
  const [roomEditing, setRoomEditing] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoom());
  const [delRoom, setDelRoom] = useState<string | null>(null);

  const [finishDialog, setFinishDialog] = useState(false);
  const [finishEditing, setFinishEditing] = useState<Finish | null>(null);
  const [finishForm, setFinishForm] = useState(emptyFinish());
  const [delFinish, setDelFinish] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [a, r, c, u, s, f] = await Promise.all([
      supabase
        .from("articles")
        .select("*")
        .eq("article_type", "materiaal")
        .order("subcategory")
        .order("name"),
      supabase.from("rooms").select("*").order("sort_order").order("name"),
      supabase.from("article_categories").select("id,scope,name").order("sort_order").order("name"),
      supabase.from("article_units").select("id,code,label").order("sort_order").order("label"),
      supabase.from("company_settings").select("default_vat_rate").maybeSingle(),
      supabase.from("finishes").select("*").order("sort_order").order("name"),
    ]);
    if (a.error) toast.error("Laden mislukt: " + a.error.message);
    else setArticles((a.data ?? []) as unknown as Article[]);
    if (!r.error) setRooms((r.data ?? []) as Room[]);
    if (!c.error) setCategories((c.data ?? []) as CategoryRow[]);
    if (!u.error) setUnits((u.data ?? []) as UnitRow[]);
    if (!s.error && s.data?.default_vat_rate != null)
      setDefaultVat(Number(s.data.default_vat_rate));
    if (!f.error) setFinishes((f.data ?? []) as Finish[]);
    setLoading(false);
  };

  const materialCats = uniqueNames(
    categories.filter((c) => c.scope === "materiaal").map((c) => c.name),
  );
  const unitOptions = normalizeUnits(units);

  const filteredMaterials = useMemo(() => {
    return articles
      .filter((a) => filterCat === "alle" || a.subcategory === filterCat)
      .filter((a) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) || (a.subcategory ?? "").toLowerCase().includes(q)
        );
      });
  }, [articles, filterCat, search]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (!search.trim()) return true;
      return r.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [rooms, search]);

  const filteredFinishes = useMemo(() => {
    return finishes.filter((f) => {
      if (!search.trim()) return true;
      return f.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [finishes, search]);

  // ---- Materiaal handlers ----
  const openNewMat = () => {
    setMatEditing(null);
    setMatForm(emptyMaterial(defaultVat));
    setMatDialog(true);
  };
  const openEditMat = (a: Article) => {
    setMatEditing(a);
    setMatForm({
      category: a.category,
      subcategory: a.subcategory ?? "",
      name: a.name,
      description: a.description ?? "",
      unit: a.unit,
      unit_label: a.unit_label ?? "",
      vat_rate: Number(a.vat_rate),
      price: Number(a.price),
      cost_price: a.cost_price !== null ? Number(a.cost_price) : null,
      is_active: a.is_active,
    });
    setMatDialog(true);
  };
  const saveMat = async () => {
    if (!user) return;
    if (!matForm.name.trim()) return toast.error("Naam is verplicht");
    if (!matForm.subcategory.trim()) return toast.error("Categorie is verplicht");
    const payload = {
      user_id: user.id,
      article_type: "materiaal" as const,
      category: matForm.category.trim() || "Materialen",
      subcategory: matForm.subcategory.trim() || null,
      name: matForm.name.trim(),
      description: matForm.description.trim() || null,
      unit: matForm.unit,
      unit_label: matForm.unit_label.trim() || null,
      vat_rate: Number(matForm.vat_rate),
      price: Number(matForm.price) || 0,
      cost_price:
        matForm.cost_price !== null && !Number.isNaN(matForm.cost_price)
          ? Number(matForm.cost_price)
          : null,
      is_active: matForm.is_active,
    };
    const res = matEditing
      ? await supabase.from("articles").update(payload).eq("id", matEditing.id)
      : await supabase.from("articles").insert(payload);
    if (res.error) return toast.error("Opslaan mislukt: " + res.error.message);
    toast.success(matEditing ? "Materiaal bijgewerkt" : "Materiaal toegevoegd");
    setMatDialog(false);
    load();
  };
  const removeMat = async () => {
    if (!delMat) return;
    const { error } = await supabase.from("articles").delete().eq("id", delMat);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Verwijderd");
      load();
    }
    setDelMat(null);
  };

  // ---- Ruimte handlers ----
  const openNewRoom = () => {
    setRoomEditing(null);
    setRoomForm(emptyRoom());
    setRoomDialog(true);
  };
  const openEditRoom = (r: Room) => {
    setRoomEditing(r);
    setRoomForm({
      name: r.name,
      default_walls: r.default_walls,
      include_ceiling: r.include_ceiling,
      default_m2: r.default_m2 !== null ? Number(r.default_m2) : null,
      price_per_m2: Number(r.price_per_m2),
      vat_rate: Number(r.vat_rate),
      is_active: r.is_active,
      pricing_type: (r.pricing_type ?? "per_m2") as "per_m2" | "fixed",
      fixed_price: Number(r.fixed_price ?? 0),
    });
    setRoomDialog(true);
  };
  const saveRoom = async () => {
    if (!user) return;
    if (!roomForm.name.trim()) return toast.error("Naam is verplicht");
    const payload = {
      user_id: user.id,
      name: roomForm.name.trim(),
      default_walls: Number(roomForm.default_walls) || 0,
      include_ceiling: roomForm.include_ceiling,
      default_m2:
        roomForm.default_m2 !== null && !Number.isNaN(roomForm.default_m2)
          ? Number(roomForm.default_m2)
          : null,
      price_per_m2: Number(roomForm.price_per_m2) || 0,
      vat_rate: Number(roomForm.vat_rate),
      is_active: roomForm.is_active,
      pricing_type: roomForm.pricing_type,
      fixed_price: Number(roomForm.fixed_price) || 0,
    };
    const res = roomEditing
      ? await supabase.from("rooms").update(payload).eq("id", roomEditing.id)
      : await supabase.from("rooms").insert(payload);
    if (res.error) return toast.error("Opslaan mislukt: " + res.error.message);
    toast.success(roomEditing ? "Ruimte bijgewerkt" : "Ruimte toegevoegd");
    setRoomDialog(false);
    load();
  };
  const removeRoom = async () => {
    if (!delRoom) return;
    const { error } = await supabase.from("rooms").delete().eq("id", delRoom);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Verwijderd");
      load();
    }
    setDelRoom(null);
  };

  // ---- Afwerking handlers ----
  const openNewFinish = () => {
    setFinishEditing(null);
    setFinishForm(emptyFinish());
    setFinishDialog(true);
  };
  const openEditFinish = (f: Finish) => {
    setFinishEditing(f);
    setFinishForm({
      name: f.name,
      price_per_m2: Number(f.price_per_m2),
      is_active: f.is_active,
    });
    setFinishDialog(true);
  };
  const saveFinish = async () => {
    if (!user) return;
    if (!finishForm.name.trim()) return toast.error("Naam is verplicht");
    const payload = {
      user_id: user.id,
      name: finishForm.name.trim(),
      price_per_m2: Number(finishForm.price_per_m2) || 0,
      is_active: finishForm.is_active,
    };
    const res = finishEditing
      ? await supabase.from("finishes").update(payload).eq("id", finishEditing.id)
      : await supabase.from("finishes").insert(payload);
    if (res.error) return toast.error("Opslaan mislukt: " + res.error.message);
    toast.success(finishEditing ? "Afwerking bijgewerkt" : "Afwerking toegevoegd");
    setFinishDialog(false);
    load();
  };
  const removeFinish = async () => {
    if (!delFinish) return;
    const { error } = await supabase.from("finishes").delete().eq("id", delFinish);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Verwijderd");
      load();
    }
    setDelFinish(null);
  };

  if (authLoading || !user) return null;

  const selectedMatCat = materialCats.includes(matForm.subcategory)
    ? matForm.subcategory
    : undefined;
  const selectedUnit = unitOptions.some((u) => u.code === matForm.unit) ? matForm.unit : undefined;

  return (
    <AppShell title="Artikelen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Artikelen</h1>
            <p className="text-muted-foreground">Materialen en ruimten beheren</p>
          </div>
          <Button
            onClick={
              tab === "materiaal"
                ? openNewMat
                : tab === "ruimte"
                  ? openNewRoom
                  : openNewFinish
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Nieuw
          </Button>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "materiaal" | "ruimte" | "afwerking");
            setFilterCat("alle");
            setSearch("");
          }}
        >
          <TabsList>
            <TabsTrigger value="materiaal">Materialen</TabsTrigger>
            <TabsTrigger value="ruimte">Ruimten</TabsTrigger>
            <TabsTrigger value="afwerking">Afwerkingen</TabsTrigger>
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
              </div>

              <TabsContent value="materiaal" className="m-0">
                <div className="mb-4">
                  <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle</SelectItem>
                      {materialCats.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Laden...</p>
                ) : filteredMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen materialen gevonden.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categorie</TableHead>
                        <TableHead>Naam</TableHead>
                        <TableHead>Eenheid</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead>BTW</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaterials.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.subcategory ?? "—"}</TableCell>
                          <TableCell className="font-medium">
                            {a.name}
                            {!a.is_active && (
                              <Badge variant="outline" className="ml-2">
                                inactief
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{a.unit_label || a.unit}</TableCell>
                          <TableCell className="text-right">
                            € {Number(a.price).toFixed(2)}
                          </TableCell>
                          <TableCell>{Number(a.vat_rate)}%</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEditMat(a)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDelMat(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="ruimte" className="m-0">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Laden...</p>
                ) : filteredRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen ruimten. Klik op "Nieuw" om er een toe te voegen.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Wanden</TableHead>
                        <TableHead>Plafond</TableHead>
                        <TableHead className="text-right">m²</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead>BTW</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRooms.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {r.name}
                            {!r.is_active && (
                              <Badge variant="outline" className="ml-2">
                                inactief
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.pricing_type === "fixed" ? "Vast" : "Per m²"}
                          </TableCell>
                          <TableCell className="text-right">{r.default_walls}</TableCell>
                          <TableCell>{r.include_ceiling ? "Ja" : "Nee"}</TableCell>
                          <TableCell className="text-right">
                            {r.pricing_type === "fixed"
                              ? "—"
                              : r.default_m2 !== null
                                ? Number(r.default_m2).toFixed(2)
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.pricing_type === "fixed"
                              ? `€ ${Number(r.fixed_price).toFixed(2)}`
                              : `€ ${Number(r.price_per_m2).toFixed(2)} / m²`}
                          </TableCell>
                          <TableCell>{Number(r.vat_rate)}%</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEditRoom(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDelRoom(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="afwerking" className="m-0">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Laden...</p>
                ) : filteredFinishes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen afwerkingen. Klik op "Nieuw" om er een toe te voegen.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead className="text-right">Prijs per m²</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishes.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">
                            {f.name}
                            {!f.is_active && (
                              <Badge variant="outline" className="ml-2">
                                inactief
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            € {Number(f.price_per_m2).toFixed(2)} / m²
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEditFinish(f)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDelFinish(f.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>

      {/* Materiaal dialog */}
      <Dialog open={matDialog} onOpenChange={setMatDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{matEditing ? "Materiaal bewerken" : "Nieuw materiaal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Categorie</Label>
              {materialCats.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nog geen categorieën. Maak ze aan via{" "}
                  <Link to="/instellingen" className="underline">
                    Instellingen
                  </Link>
                  .
                </p>
              ) : (
                <Select
                  value={selectedMatCat}
                  onValueChange={(v) => setMatForm({ ...matForm, subcategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materialCats.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Naam</Label>
              <Input
                value={matForm.name}
                onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                placeholder="bv. Hoekprofiel 2m"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>BTW (%)</Label>
                <Select
                  value={String(matForm.vat_rate)}
                  onValueChange={(v) => setMatForm({ ...matForm, vat_rate: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (verlegd)</SelectItem>
                    <SelectItem value="9">9%</SelectItem>
                    <SelectItem value="21">21%</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Standaard uit Bedrijfsgegevens, hier wijzigbaar.
                </p>
              </div>
              <div>
                <Label>Eenheid</Label>
                {unitOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nog geen eenheden. Maak ze aan via{" "}
                    <Link to="/instellingen" className="underline">
                      Instellingen
                    </Link>
                    .
                  </p>
                ) : (
                  <Select
                    value={selectedUnit}
                    onValueChange={(v) => setMatForm({ ...matForm, unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kies..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((u) => (
                        <SelectItem key={u.code} value={u.code}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div>
              <Label>Omschrijving</Label>
              <Textarea
                rows={2}
                value={matForm.description}
                onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Verkoopprijs (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={matForm.price}
                  onChange={(e) => setMatForm({ ...matForm, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Inkoopprijs (€) — optioneel</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={matForm.cost_price ?? ""}
                  onChange={(e) =>
                    setMatForm({
                      ...matForm,
                      cost_price: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={saveMat}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ruimte dialog */}
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roomEditing ? "Ruimte bewerken" : "Nieuwe ruimte"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Naam</Label>
              <Input
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="bv. Keuken, Woonkamer, Slaapkamer"
              />
            </div>
            <div>
              <Label>Prijstype</Label>
              <Select
                value={roomForm.pricing_type}
                onValueChange={(v) =>
                  setRoomForm({ ...roomForm, pricing_type: v as "per_m2" | "fixed" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_m2">Per m²</SelectItem>
                  <SelectItem value="fixed">Vast bedrag</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Kies "Vast bedrag" voor ruimten zoals een toilet met een vaste prijs.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Standaard aantal wanden</Label>
                <Input
                  type="number"
                  min={0}
                  value={roomForm.default_walls}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, default_walls: Number(e.target.value) })
                  }
                />
              </div>
              {roomForm.pricing_type === "per_m2" && (
                <div>
                  <Label>Standaard vierkante meters</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={roomForm.default_m2 ?? ""}
                    onChange={(e) =>
                      setRoomForm({
                        ...roomForm,
                        default_m2: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="optioneel"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Plafond standaard meenemen</Label>
                <p className="text-xs text-muted-foreground">
                  Bij offerte aan/uit te zetten per ruimte.
                </p>
              </div>
              <Switch
                checked={roomForm.include_ceiling}
                onCheckedChange={(v) => setRoomForm({ ...roomForm, include_ceiling: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {roomForm.pricing_type === "per_m2" ? (
                <div>
                  <Label>Prijs per m² (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={roomForm.price_per_m2}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, price_per_m2: Number(e.target.value) })
                    }
                  />
                </div>
              ) : (
                <div>
                  <Label>Vast bedrag (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={roomForm.fixed_price}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, fixed_price: Number(e.target.value) })
                    }
                    placeholder="bv. 275.00"
                  />
                </div>
              )}
              <div>
                <Label>BTW (%)</Label>
                <Select
                  value={String(roomForm.vat_rate)}
                  onValueChange={(v) => setRoomForm({ ...roomForm, vat_rate: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (verlegd)</SelectItem>
                    <SelectItem value="9">9%</SelectItem>
                    <SelectItem value="21">21%</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Standaard 9% (laag tarief).</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Actief</Label>
              <Switch
                checked={roomForm.is_active}
                onCheckedChange={(v) => setRoomForm({ ...roomForm, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={saveRoom}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delMat} onOpenChange={(o) => !o && setDelMat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Materiaal verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={removeMat}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delRoom} onOpenChange={(o) => !o && setDelRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ruimte verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={removeRoom}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Afwerking dialog */}
      <Dialog open={finishDialog} onOpenChange={setFinishDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {finishEditing ? "Afwerking bewerken" : "Nieuwe afwerking"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Naam</Label>
              <Input
                value={finishForm.name}
                onChange={(e) => setFinishForm({ ...finishForm, name: e.target.value })}
                placeholder="bv. Spachtelputz, Sausen, Behangklaar"
              />
            </div>
            <div>
              <Label>Prijs per m² (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={finishForm.price_per_m2}
                onChange={(e) =>
                  setFinishForm({ ...finishForm, price_per_m2: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Actief</Label>
              <Switch
                checked={finishForm.is_active}
                onCheckedChange={(v) => setFinishForm({ ...finishForm, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={saveFinish}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delFinish} onOpenChange={(o) => !o && setDelFinish(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Afwerking verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={removeFinish}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
