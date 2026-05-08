import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/medewerkers")({
  component: MedewerkersPage,
});

type Employee = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  bsn: string | null;
  date_of_birth: string | null;
  street: string | null;
  house_number: string | null;
  house_number_addition: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  job_title: string | null;
  status: string;
  notes: string | null;
};

const empty = {
  first_name: "",
  middle_name: "",
  last_name: "",
  bsn: "",
  date_of_birth: "",
  street: "",
  house_number: "",
  house_number_addition: "",
  postal_code: "",
  city: "",
  phone: "",
  mobile: "",
  email: "",
  job_title: "",
  status: "actief",
  notes: "",
};

function MedewerkersPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("last_name", { ascending: true });
    if (error) {
      toast.error("Kon medewerkers niet laden");
      return;
    }
    setItems((data ?? []) as Employee[]);
  }

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      first_name: e.first_name ?? "",
      middle_name: e.middle_name ?? "",
      last_name: e.last_name ?? "",
      bsn: e.bsn ?? "",
      date_of_birth: e.date_of_birth ?? "",
      street: e.street ?? "",
      house_number: e.house_number ?? "",
      house_number_addition: e.house_number_addition ?? "",
      postal_code: e.postal_code ?? "",
      city: e.city ?? "",
      phone: e.phone ?? "",
      mobile: e.mobile ?? "",
      email: e.email ?? "",
      job_title: e.job_title ?? "",
      status: e.status ?? "actief",
      notes: e.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Voornaam en achternaam zijn verplicht");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      bsn: form.bsn.trim() || null,
      date_of_birth: form.date_of_birth || null,
      street: form.street.trim() || null,
      house_number: form.house_number.trim() || null,
      house_number_addition: form.house_number_addition.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      job_title: form.job_title.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("employees").update(payload).eq("id", editing.id)
      : await supabase.from("employees").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    toast.success(editing ? "Medewerker bijgewerkt" : "Medewerker toegevoegd");
    setOpen(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("employees").delete().eq("id", deleteId);
    if (error) {
      toast.error("Verwijderen mislukt");
    } else {
      toast.success("Medewerker verwijderd");
      load();
    }
    setDeleteId(null);
  }

  const filtered = items.filter((e) => {
    const q = search.toLowerCase();
    const full = `${e.first_name} ${e.middle_name ?? ""} ${e.last_name}`.toLowerCase();
    return (
      full.includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.job_title ?? "").toLowerCase().includes(q)
    );
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Medewerkers</h2>
          <p className="text-muted-foreground">HR-dossier en personeelsgegevens</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe medewerker
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam, e-mail of functie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              {items.length === 0
                ? "Nog geen medewerkers. Klik op 'Nieuwe medewerker' om te starten."
                : "Geen resultaten."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Functie</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Mobiel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {[e.first_name, e.middle_name, e.last_name].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>{e.job_title ?? "—"}</TableCell>
                    <TableCell>{e.email ?? "—"}</TableCell>
                    <TableCell>{e.mobile ?? e.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "actief" ? "default" : "secondary"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(e.id)}
                        >
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Medewerker bewerken" : "Nieuwe medewerker"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Voornaam *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Tussenvoegsel</Label>
                <Input
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Achternaam *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>BSN</Label>
                <Input
                  value={form.bsn}
                  onChange={(e) => setForm({ ...form, bsn: e.target.value })}
                  placeholder="9 cijfers"
                />
              </div>
              <div>
                <Label>Geboortedatum</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <div>
                <Label>Straat</Label>
                <Input
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div>
                <Label>Huisnr.</Label>
                <Input
                  value={form.house_number}
                  onChange={(e) => setForm({ ...form, house_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Toevoeging</Label>
                <Input
                  value={form.house_number_addition}
                  onChange={(e) =>
                    setForm({ ...form, house_number_addition: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Postcode</Label>
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Plaats</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Telefoon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Mobiel</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Functie</Label>
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="bv. Stucadoor"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="actief">Actief</option>
                  <option value="uit_dienst">Uit dienst</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Notities</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Medewerker verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de medewerker permanent. Documenten en gegevens kunnen
              niet worden teruggehaald.
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
