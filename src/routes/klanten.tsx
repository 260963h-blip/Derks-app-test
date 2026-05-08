import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/klanten")({
  component: KlantenPage,
});

type CustomerType = "particulier" | "zakelijk";
type VatType = "verlegd" | "laag" | "hoog";

type Customer = {
  id: string;
  customer_type: CustomerType;
  name: string;
  street: string | null;
  house_number: string | null;
  house_number_addition: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  email_invoice: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  default_vat_type: VatType;
  default_vat_rate: number;
  notes: string | null;
};

type Contact = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  _deleted?: boolean;
};

const VAT_OPTIONS: { value: VatType; rate: number; label: string }[] = [
  { value: "verlegd", rate: 0, label: "0% – BTW verlegd" },
  { value: "laag", rate: 9, label: "9% – Laag (woning > 2 jaar)" },
  { value: "hoog", rate: 21, label: "21% – Hoog (nieuwbouw)" },
];

const emptyForm = {
  customer_type: "particulier" as CustomerType,
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

function KlantenPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    if (error) toast.error("Laden mislukt");
    else setList((data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setContacts([]);
    setOpen(true);
  };

  const openEdit = async (c: Customer) => {
    setEditing(c);
    setForm({
      customer_type: c.customer_type ?? "particulier",
      name: c.name,
      street: c.street ?? "",
      house_number: c.house_number ?? "",
      house_number_addition: c.house_number_addition ?? "",
      postal_code: c.postal_code ?? "",
      city: c.city ?? "",
      country: c.country ?? "Nederland",
      phone: c.phone ?? "",
      email: c.email ?? "",
      email_invoice: c.email_invoice ?? "",
      kvk_number: c.kvk_number ?? "",
      vat_number: c.vat_number ?? "",
      default_vat_type: (c.default_vat_type ?? "hoog") as VatType,
      notes: c.notes ?? "",
    });
    // Laad contactpersonen
    const { data } = await supabase
      .from("customer_contacts")
      .select("*")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: true });
    setContacts(
      (data ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        phone: x.phone ?? "",
        email: x.email ?? "",
      })),
    );
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error(form.customer_type === "zakelijk" ? "Bedrijfsnaam is verplicht" : "Naam is verplicht");
      return;
    }
    setSaving(true);
    const vatRate = VAT_OPTIONS.find((v) => v.value === form.default_vat_type)?.rate ?? 21;

    const payload: any = {
      user_id: user.id,
      customer_type: form.customer_type,
      name: form.name.trim(),
      street: form.street || null,
      house_number: form.house_number || null,
      house_number_addition: form.house_number_addition || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      country: form.country || null,
      phone: form.phone || null,
      email: form.email || null,
      email_invoice: form.customer_type === "zakelijk" ? form.email_invoice || null : null,
      kvk_number: form.customer_type === "zakelijk" ? form.kvk_number || null : null,
      vat_number: form.customer_type === "zakelijk" ? form.vat_number || null : null,
      default_vat_type: form.default_vat_type,
      default_vat_rate: vatRate,
      notes: form.notes || null,
    };

    let customerId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error("Opslaan mislukt: " + error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
      if (error || !data) {
        setSaving(false);
        toast.error("Opslaan mislukt: " + (error?.message ?? ""));
        return;
      }
      customerId = data.id;
    }

    // Contactpersonen synchroniseren (alleen voor zakelijk)
    if (customerId && form.customer_type === "zakelijk") {
      for (const c of contacts) {
        if (c._deleted && c.id) {
          await supabase.from("customer_contacts").delete().eq("id", c.id);
        } else if (!c._deleted && c.name.trim()) {
          if (c.id) {
            await supabase
              .from("customer_contacts")
              .update({ name: c.name, phone: c.phone || null, email: c.email || null })
              .eq("id", c.id);
          } else {
            await supabase.from("customer_contacts").insert({
              user_id: user.id,
              customer_id: customerId,
              name: c.name,
              phone: c.phone || null,
              email: c.email || null,
            });
          }
        }
      }
    }

    setSaving(false);
    toast.success(editing ? "Klant bijgewerkt" : "Klant toegevoegd");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("customers").delete().eq("id", deleteId);
    if (error) toast.error("Verwijderen mislukt");
    else {
      toast.success("Klant verwijderd");
      load();
    }
    setDeleteId(null);
  };

  const filtered = list.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const isZakelijk = form.customer_type === "zakelijk";

  return (
    <AppShell title="Klanten" subtitle="Beheer je klantenlijst" back>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op naam, plaats, e-mail"
            className="pl-8"
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nieuwe klant
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Laden...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-muted-foreground">
              {list.length === 0
                ? "Nog geen klanten. Klik op 'Nieuwe klant' om je eerste klant toe te voegen."
                : "Geen klanten gevonden."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Plaats</TableHead>
                  <TableHead>BTW</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant={c.customer_type === "zakelijk" ? "default" : "secondary"}>
                        {c.customer_type === "zakelijk" ? "Zakelijk" : "Particulier"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
                    <TableCell>{Number(c.default_vat_rate ?? 21)}%</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-5">
            {/* Type keuze */}
            <div className="space-y-2">
              <Label>Type klant</Label>
              <RadioGroup
                value={form.customer_type}
                onValueChange={(v) => setForm({ ...form, customer_type: v as CustomerType })}
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="particulier" id="t-part" />
                  <span>Particulier</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="zakelijk" id="t-zak" />
                  <span>Zakelijk</span>
                </label>
              </RadioGroup>
            </div>

            {/* Naam */}
            <div className="grid gap-4 sm:grid-cols-2">
              <F
                label={isZakelijk ? "Bedrijfsnaam *" : "Naam *"}
                v={form.name}
                on={(v) => setForm({ ...form, name: v })}
              />
              {!isZakelijk && (
                <F label="Telefoonnummer" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
              )}
            </div>

            {/* Adres */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-6">
                <Label>Straat</Label>
                <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Label>Huisnr.</Label>
                <Input
                  value={form.house_number}
                  onChange={(e) => setForm({ ...form, house_number: e.target.value })}
                />
              </div>
              <div className="col-span-8 sm:col-span-4">
                <Label>Toevoeging</Label>
                <Input
                  value={form.house_number_addition}
                  onChange={(e) => setForm({ ...form, house_number_addition: e.target.value })}
                />
              </div>
              <div className="col-span-4">
                <Label>Postcode</Label>
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                />
              </div>
              <div className="col-span-8">
                <Label>Plaats</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>

            {/* Particulier velden */}
            {!isZakelijk && (
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="E-mailadres" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
              </div>
            )}

            {/* Zakelijk velden */}
            {isZakelijk && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="KvK-nummer" v={form.kvk_number} on={(v) => setForm({ ...form, kvk_number: v })} />
                  <F label="BTW-nummer" v={form.vat_number} on={(v) => setForm({ ...form, vat_number: v })} />
                  <F
                    label="E-mail algemeen"
                    v={form.email}
                    on={(v) => setForm({ ...form, email: v })}
                    type="email"
                  />
                  <F
                    label="E-mail facturatie"
                    v={form.email_invoice}
                    on={(v) => setForm({ ...form, email_invoice: v })}
                    type="email"
                  />
                  <F label="Telefoonnummer" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
                </div>

                {/* Contactpersonen */}
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Contactpersonen</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setContacts([...contacts, { name: "", phone: "", email: "" }])
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Toevoegen
                    </Button>
                  </div>
                  {contacts.filter((c) => !c._deleted).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nog geen contactpersonen.</p>
                  )}
                  {contacts.map((c, i) =>
                    c._deleted ? null : (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-4">
                          <Label className="text-xs">Naam</Label>
                          <Input
                            value={c.name}
                            onChange={(e) => {
                              const n = [...contacts];
                              n[i] = { ...n[i], name: e.target.value };
                              setContacts(n);
                            }}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <Label className="text-xs">GSM</Label>
                          <Input
                            value={c.phone}
                            onChange={(e) => {
                              const n = [...contacts];
                              n[i] = { ...n[i], phone: e.target.value };
                              setContacts(n);
                            }}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-4">
                          <Label className="text-xs">E-mail</Label>
                          <Input
                            type="email"
                            value={c.email}
                            onChange={(e) => {
                              const n = [...contacts];
                              n[i] = { ...n[i], email: e.target.value };
                              setContacts(n);
                            }}
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const n = [...contacts];
                              if (n[i].id) n[i] = { ...n[i], _deleted: true };
                              else n.splice(i, 1);
                              setContacts(n);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}

            {/* BTW keuze */}
            <div className="space-y-2">
              <Label>Standaard BTW-tarief voor deze klant</Label>
              <Select
                value={form.default_vat_type}
                onValueChange={(v) => setForm({ ...form, default_vat_type: v as VatType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wordt later voorgesteld bij het maken van een offerte. Per offerte aanpasbaar.
              </p>
            </div>

            {/* Notities */}
            <div className="space-y-2">
              <Label>Notities</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Opslaan..." : "Opslaan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit kan niet ongedaan worden gemaakt. Bijbehorende contactpersonen worden ook verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function F({
  label,
  v,
  on,
  type = "text",
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
