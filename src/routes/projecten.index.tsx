import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projecten/")({
  component: ProjectenPage,
});

type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  customer_id: string | null;
  contact_id: string | null;
  reference: string | null;
  created_at: string;
  customer_name?: string | null;
};

type Customer = { id: string; name: string; customer_type: string };

type VatType = "verlegd" | "laag" | "hoog";
type Contact = { name: string; phone: string; email: string };

const VAT_OPTIONS: { value: VatType; rate: number; label: string }[] = [
  { value: "verlegd", rate: 0, label: "0% – BTW verlegd" },
  { value: "laag", rate: 9, label: "9% – Laag (woning > 2 jaar)" },
  { value: "hoog", rate: 21, label: "21% – Hoog (nieuwbouw)" },
];

const emptyNewCust = {
  customer_type: "particulier" as "particulier" | "zakelijk",
  name: "",
  street: "",
  house_number: "",
  house_number_addition: "",
  postal_code: "",
  city: "",
  country: "Nederland",
  phone: "",
  email: "",
  email_invoice: "",
  kvk_number: "",
  vat_number: "",
  default_vat_type: "hoog" as VatType,
  notes: "",
};

function ProjectenPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // wizard state
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [pickedCustomer, setPickedCustomer] = useState<string>("");
  const [newCust, setNewCust] = useState(emptyNewCust);
  const [newContacts, setNewContacts] = useState<Contact[]>([]);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,status,customer_id,contact_id,reference,created_at")
      .order("created_at", { ascending: false });
    if (error) return toast.error("Laden mislukt: " + error.message);
    const rows = (data ?? []) as Project[];
    const ids = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: cs } = await supabase.from("customers").select("id,name").in("id", ids);
      const map = new Map((cs ?? []).map((c) => [c.id, c.name]));
      rows.forEach((r) => (r.customer_name = r.customer_id ? map.get(r.customer_id) ?? null : null));
    }
    setProjects(rows);
    const { data: allCust } = await supabase
      .from("customers")
      .select("id,name,customer_type")
      .order("name");
    setCustomers((allCust ?? []) as Customer[]);
  };

  const resetWizard = () => {
    setMode("existing");
    setPickedCustomer("");
    setNewCust(emptyNewCust);
    setNewContacts([]);
    setTitle("");
    setReference("");
  };

  const createProject = async () => {
    if (!user) return;
    setCreating(true);
    try {
      // 1) Klant
      let customerId = pickedCustomer || null;
      if (mode === "new") {
        if (!newCust.name.trim()) {
          toast.error(newCust.customer_type === "zakelijk" ? "Bedrijfsnaam is verplicht" : "Naam is verplicht");
          setCreating(false);
          return;
        }
        const isZak = newCust.customer_type === "zakelijk";
        const vatRate = VAT_OPTIONS.find((v) => v.value === newCust.default_vat_type)?.rate ?? 21;
        const { data: c, error: ce } = await supabase
          .from("customers")
          .insert({
            user_id: user.id,
            name: newCust.name.trim(),
            customer_type: newCust.customer_type,
            email: newCust.email || null,
            email_invoice: isZak ? newCust.email_invoice || null : null,
            phone: newCust.phone || null,
            street: newCust.street || null,
            house_number: newCust.house_number || null,
            house_number_addition: newCust.house_number_addition || null,
            postal_code: newCust.postal_code || null,
            city: newCust.city || null,
            country: newCust.country || null,
            kvk_number: isZak ? newCust.kvk_number || null : null,
            vat_number: isZak ? newCust.vat_number || null : null,
            default_vat_type: newCust.default_vat_type,
            default_vat_rate: vatRate,
            notes: newCust.notes || null,
          })
          .select("id")
          .single();
        if (ce) throw ce;
        customerId = c.id;

        if (isZak && newContacts.length) {
          const rows = newContacts
            .filter((ct) => ct.name.trim())
            .map((ct) => ({
              user_id: user.id,
              customer_id: customerId,
              name: ct.name.trim(),
              phone: ct.phone || null,
              email: ct.email || null,
            }));
          if (rows.length) await supabase.from("customer_contacts").insert(rows);
        }
      } else if (!customerId) {
        toast.error("Selecteer een klant");
        setCreating(false);
        return;
      }

      // 2) Nummer ophalen
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

      // 3) Project aanmaken
      const { data: p, error: pe } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          project_number: number,
          title: title || number,
          customer_id: customerId,
          reference: reference || null,
          status: "nieuw",
        })
        .select("id")
        .single();
      if (pe) throw pe;

      // 4) Offerte aanmaken met zelfde nummer + project_id
      const { error: qe } = await supabase.from("quotes").insert({
        user_id: user.id,
        project_id: p.id,
        quote_number: number,
        customer_id: customerId,
        reference: reference || null,
        quote_date: new Date().toISOString().slice(0, 10),
        valid_until: validUntil.toISOString().slice(0, 10),
        status: "concept",
      });
      if (qe) throw qe;

      // 5) Teller ophogen
      await supabase
        .from("company_settings")
        .update({ quote_number_next: next + 1 })
        .eq("user_id", user.id);

      setOpen(false);
      resetWizard();
      navigate({ to: "/projecten/$id", params: { id: p.id } });
    } catch (e: any) {
      toast.error("Aanmaken mislukt: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const removeProject = async (id: string) => {
    if (!confirm("Project verwijderen? Bijbehorende offerte en documenten blijven staan.")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (authLoading || !user) return null;

  const filtered = projects.filter((p) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      p.project_number.toLowerCase().includes(s) ||
      (p.title ?? "").toLowerCase().includes(s) ||
      (p.customer_name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <AppShell title="Projecten" subtitle="Projectdossiers met offerte, werkorder en factuur" back>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op nummer, titel of klant..."
            className="pl-8"
          />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetWizard(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Nieuw project</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nieuw project aanmaken</DialogTitle></DialogHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Bestaande klant</TabsTrigger>
                <TabsTrigger value="new">Nieuwe klant</TabsTrigger>
              </TabsList>
              <TabsContent value="existing" className="space-y-2 pt-3">
                <Label className="text-xs">Klant</Label>
                <Select value={pickedCustomer || undefined} onValueChange={setPickedCustomer}>
                  <SelectTrigger><SelectValue placeholder="Kies klant..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.customer_type === "zakelijk" ? "· zakelijk" : "· particulier"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="new" className="grid grid-cols-2 gap-2 pt-3">
                <div className="col-span-2">
                  <Label className="text-xs">Naam *</Label>
                  <Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Type</Label>
                  <Select value={newCust.customer_type} onValueChange={(v) => setNewCust({ ...newCust, customer_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="zakelijk">Zakelijk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">E-mail</Label>
                  <Input value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} /></div>
                <div><Label className="text-xs">Telefoon</Label>
                  <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /></div>
                <div><Label className="text-xs">Straat</Label>
                  <Input value={newCust.street} onChange={(e) => setNewCust({ ...newCust, street: e.target.value })} /></div>
                <div><Label className="text-xs">Huisnr.</Label>
                  <Input value={newCust.house_number} onChange={(e) => setNewCust({ ...newCust, house_number: e.target.value })} /></div>
                <div><Label className="text-xs">Postcode</Label>
                  <Input value={newCust.postal_code} onChange={(e) => setNewCust({ ...newCust, postal_code: e.target.value })} /></div>
                <div><Label className="text-xs">Plaats</Label>
                  <Input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} /></div>
              </TabsContent>
            </Tabs>
            <div className="space-y-2 border-t pt-3">
              <div>
                <Label className="text-xs">Projecttitel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="bv. Stucwerk woonkamer" />
              </div>
              <div>
                <Label className="text-xs">Referentie (optioneel)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="bv. inkoopordernr." />
              </div>
              <p className="text-xs text-muted-foreground">
                Projectnummer wordt automatisch aangemaakt en is gelijk aan het offertenummer.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button onClick={createProject} disabled={creating}>
                {creating ? "Aanmaken..." : "Project aanmaken"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="pt-6">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen projecten. Maak je eerste project aan.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen projecten gevonden voor "{search}".</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">
                      <Link to="/projecten/$id" params={{ id: p.id }} className="text-primary hover:underline">
                        {p.project_number}
                      </Link>
                    </TableCell>
                    <TableCell>{p.title || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{p.customer_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/projecten/$id", params: { id: p.id } })} title="Openen">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeProject(p.id)} title="Verwijderen">
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