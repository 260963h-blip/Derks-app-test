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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/klanten")({
  component: KlantenPage,
});

type Customer = {
  id: string;
  name: string;
  contact_person: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  notes: string | null;
};

const emptyForm = {
  name: "",
  contact_person: "",
  address: "",
  postal_code: "",
  city: "",
  country: "Nederland",
  phone: "",
  email: "",
  kvk_number: "",
  vat_number: "",
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
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      contact_person: c.contact_person ?? "",
      address: c.address ?? "",
      postal_code: c.postal_code ?? "",
      city: c.city ?? "",
      country: c.country ?? "Nederland",
      phone: c.phone ?? "",
      email: c.email ?? "",
      kvk_number: c.kvk_number ?? "",
      vat_number: c.vat_number ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      address: form.address || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      country: form.country || null,
      phone: form.phone || null,
      email: form.email || null,
      kvk_number: form.kvk_number || null,
      vat_number: form.vat_number || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
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
                  <TableHead>Naam</TableHead>
                  <TableHead>Plaats</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <F label="Naam *" v={form.name} on={(v) => setForm({ ...form, name: v })} />
            <F label="Contactpersoon" v={form.contact_person} on={(v) => setForm({ ...form, contact_person: v })} />
            <F label="Adres" v={form.address} on={(v) => setForm({ ...form, address: v })} />
            <div className="grid grid-cols-2 gap-2">
              <F label="Postcode" v={form.postal_code} on={(v) => setForm({ ...form, postal_code: v })} />
              <F label="Plaats" v={form.city} on={(v) => setForm({ ...form, city: v })} />
            </div>
            <F label="Land" v={form.country} on={(v) => setForm({ ...form, country: v })} />
            <F label="Telefoon" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
            <F label="E-mail" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
            <F label="KvK-nummer" v={form.kvk_number} on={(v) => setForm({ ...form, kvk_number: v })} />
            <F label="BTW-nummer" v={form.vat_number} on={(v) => setForm({ ...form, vat_number: v })} />
            <div className="space-y-2 sm:col-span-2">
              <Label>Notities</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter className="sm:col-span-2">
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
              Dit kan niet ongedaan worden gemaakt.
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