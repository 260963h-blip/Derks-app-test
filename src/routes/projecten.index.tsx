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
type ExistingContact = { id: string; name: string; phone: string | null; email: string | null };

const VAT_OPTIONS: { value: VatType; rate: number; label: string }[] = [
  { value: "verlegd", rate: 0, label: "0% – BTW verlegd" },
  { value: "laag", rate: 9, label: "9% – Laag (woning > 2 jaar)" },
  { value: "hoog", rate: 21, label: "21% – Hoog (nieuwbouw)" },
];

const STATUS_LABELS: Record<string, string> = {
  nieuw: "Nieuw",
  offerte: "Offerte verzonden",
  akkoord: "Akkoord",
  in_uitvoering: "In uitvoering",
  te_factureren: "Te factureren",
  afgerond: "Afgerond",
  gefactureerd: "Gefactureerd",
};

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
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // wizard state
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [pickedCustomer, setPickedCustomer] = useState<string>("");
  const [newCust, setNewCust] = useState(emptyNewCust);
  const [newContacts, setNewContacts] = useState<Contact[]>([]);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  // contactpersonen voor bestaande zakelijke klant
  const [existingContacts, setExistingContacts] = useState<ExistingContact[]>([]);
  const [pickedContactId, setPickedContactId] = useState<string>("");
  const [extraContacts, setExtraContacts] = useState<Contact[]>([]);

  const pickedCustomerObj = customers.find((c) => c.id === pickedCustomer);
  const pickedIsZakelijk = pickedCustomerObj?.customer_type === "zakelijk";

  useEffect(() => {
    setPickedContactId("");
    setExtraContacts([]);
    setExistingContacts([]);
    if (!pickedCustomer || !pickedIsZakelijk) return;
    (async () => {
      const { data } = await supabase
        .from("customer_contacts")
        .select("id,name,phone,email")
        .eq("customer_id", pickedCustomer)
        .order("created_at", { ascending: true });
      setExistingContacts((data ?? []) as ExistingContact[]);
    })();
  }, [pickedCustomer, pickedIsZakelijk]);

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
    setPickedContactId("");
    setExtraContacts([]);
    setExistingContacts([]);
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
          const cid = customerId as string;
          const rows = newContacts
            .filter((ct) => ct.name.trim())
            .map((ct) => ({
              user_id: user.id,
              customer_id: cid,
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

      // Extra contactpersonen toevoegen voor bestaande zakelijke klant
      let contactIdForProject: string | null = null;
      if (mode === "existing" && customerId && pickedIsZakelijk) {
        const toInsert = extraContacts
          .filter((ct) => ct.name.trim())
          .map((ct) => ({
            user_id: user.id,
            customer_id: customerId as string,
            name: ct.name.trim(),
            phone: ct.phone || null,
            email: ct.email || null,
          }));
        let insertedIds: string[] = [];
        if (toInsert.length) {
          const { data: ins, error: ie } = await supabase
            .from("customer_contacts")
            .insert(toInsert)
            .select("id");
          if (ie) throw ie;
          insertedIds = (ins ?? []).map((r: any) => r.id);
        }
        contactIdForProject = pickedContactId || insertedIds[0] || null;
      }

      // 2) Nummer ophalen
      const { data: cs } = await supabase
        .from("company_settings")
        .select("default_quote_validity_days")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: number, error: numErr } = await supabase.rpc("next_quote_number");
      if (numErr || !number) throw numErr ?? new Error("Offertenummer ophalen mislukt");
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
          contact_id: contactIdForProject,
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
        contact_id: contactIdForProject,
        reference: reference || null,
        quote_date: new Date().toISOString().slice(0, 10),
        valid_until: validUntil.toISOString().slice(0, 10),
        status: "concept",
      });
      if (qe) throw qe;


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
    if (statusFilter !== "alle" && p.status !== statusFilter) return false;
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statussen</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetWizard(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Nieuw project</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
                {pickedCustomer && pickedIsZakelijk && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <Label className="text-xs">Contactpersoon voor dit project</Label>
                      {existingContacts.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nog geen contactpersonen bij deze klant. Voeg er hieronder een toe.
                        </p>
                      ) : (
                        <Select value={pickedContactId || undefined} onValueChange={setPickedContactId}>
                          <SelectTrigger><SelectValue placeholder="Kies contactpersoon (optioneel)" /></SelectTrigger>
                          <SelectContent>
                            {existingContacts.map((ct) => (
                              <SelectItem key={ct.id} value={ct.id}>
                                {ct.name}{ct.email ? ` · ${ct.email}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Nieuwe contactpersoon toevoegen</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExtraContacts([...extraContacts, { name: "", phone: "", email: "" }])}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Toevoegen
                        </Button>
                      </div>
                      {extraContacts.map((c, i) => (
                        <div key={i} className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-12 sm:col-span-4">
                            <Label className="text-xs">Naam</Label>
                            <Input value={c.name} onChange={(e) => {
                              const n = [...extraContacts]; n[i] = { ...n[i], name: e.target.value }; setExtraContacts(n);
                            }} />
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <Label className="text-xs">GSM</Label>
                            <Input value={c.phone} onChange={(e) => {
                              const n = [...extraContacts]; n[i] = { ...n[i], phone: e.target.value }; setExtraContacts(n);
                            }} />
                          </div>
                          <div className="col-span-6 sm:col-span-4">
                            <Label className="text-xs">E-mail</Label>
                            <Input type="email" value={c.email} onChange={(e) => {
                              const n = [...extraContacts]; n[i] = { ...n[i], email: e.target.value }; setExtraContacts(n);
                            }} />
                          </div>
                          <div className="col-span-12 sm:col-span-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => {
                              const n = [...extraContacts]; n.splice(i, 1); setExtraContacts(n);
                            }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Nieuwe contactpersonen worden direct opgeslagen bij de klant.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="new" className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label>Type klant</Label>
                  <RadioGroup
                    value={newCust.customer_type}
                    onValueChange={(v) => setNewCust({ ...newCust, customer_type: v as "particulier" | "zakelijk" })}
                    className="flex gap-6"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <RadioGroupItem value="particulier" id="np-part" />
                      <span>Particulier</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <RadioGroupItem value="zakelijk" id="np-zak" />
                      <span>Zakelijk</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">{newCust.customer_type === "zakelijk" ? "Bedrijfsnaam *" : "Naam *"}</Label>
                    <Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                  </div>
                  {newCust.customer_type === "particulier" && (
                    <div>
                      <Label className="text-xs">Telefoonnummer</Label>
                      <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <Label className="text-xs">Straat</Label>
                    <Input value={newCust.street} onChange={(e) => setNewCust({ ...newCust, street: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">Huisnr.</Label>
                    <Input value={newCust.house_number} onChange={(e) => setNewCust({ ...newCust, house_number: e.target.value })} />
                  </div>
                  <div className="col-span-8 sm:col-span-4">
                    <Label className="text-xs">Toevoeging</Label>
                    <Input value={newCust.house_number_addition} onChange={(e) => setNewCust({ ...newCust, house_number_addition: e.target.value })} />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">Postcode</Label>
                    <Input value={newCust.postal_code} onChange={(e) => setNewCust({ ...newCust, postal_code: e.target.value })} />
                  </div>
                  <div className="col-span-8">
                    <Label className="text-xs">Plaats</Label>
                    <Input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} />
                  </div>
                </div>

                {newCust.customer_type === "particulier" && (
                  <div>
                    <Label className="text-xs">E-mailadres</Label>
                    <Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
                  </div>
                )}

                {newCust.customer_type === "zakelijk" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">KvK-nummer</Label>
                        <Input value={newCust.kvk_number} onChange={(e) => setNewCust({ ...newCust, kvk_number: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">BTW-nummer</Label>
                        <Input value={newCust.vat_number} onChange={(e) => setNewCust({ ...newCust, vat_number: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">E-mail algemeen</Label>
                        <Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">E-mail facturatie</Label>
                        <Input type="email" value={newCust.email_invoice} onChange={(e) => setNewCust({ ...newCust, email_invoice: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Telefoonnummer</Label>
                        <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                      </div>
                    </div>

                    <div className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <Label>Contactpersonen</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewContacts([...newContacts, { name: "", phone: "", email: "" }])}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Toevoegen
                        </Button>
                      </div>
                      {newContacts.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nog geen contactpersonen.</p>
                      )}
                      {newContacts.map((c, i) => (
                        <div key={i} className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-12 sm:col-span-4">
                            <Label className="text-xs">Naam</Label>
                            <Input value={c.name} onChange={(e) => {
                              const n = [...newContacts]; n[i] = { ...n[i], name: e.target.value }; setNewContacts(n);
                            }} />
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <Label className="text-xs">GSM</Label>
                            <Input value={c.phone} onChange={(e) => {
                              const n = [...newContacts]; n[i] = { ...n[i], phone: e.target.value }; setNewContacts(n);
                            }} />
                          </div>
                          <div className="col-span-6 sm:col-span-4">
                            <Label className="text-xs">E-mail</Label>
                            <Input type="email" value={c.email} onChange={(e) => {
                              const n = [...newContacts]; n[i] = { ...n[i], email: e.target.value }; setNewContacts(n);
                            }} />
                          </div>
                          <div className="col-span-12 sm:col-span-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => {
                              const n = [...newContacts]; n.splice(i, 1); setNewContacts(n);
                            }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Standaard BTW-tarief voor deze klant</Label>
                  <select
                    value={newCust.default_vat_type}
                    onChange={(e) => setNewCust({ ...newCust, default_vat_type: e.target.value as VatType })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {VAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Notities</Label>
                  <Textarea rows={3} value={newCust.notes} onChange={(e) => setNewCust({ ...newCust, notes: e.target.value })} />
                </div>
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
                    <TableCell><Badge variant="secondary">{STATUS_LABELS[p.status] ?? p.status}</Badge></TableCell>
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