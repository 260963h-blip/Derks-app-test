import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Search, FolderOpen, Save } from "lucide-react";
import { toast } from "sonner";
import { EmployeeDocumentsDialog } from "@/components/employee-documents-dialog";

export const Route = createFileRoute("/medewerkers")({
  component: MedewerkersPage,
});

type Employee = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  role: string;
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
  contract_type: string | null;
  start_date: string | null;
  probation_end_date: string | null;
  end_date: string | null;
  hours_per_week: number | null;
  work_days: string | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  vacation_days_per_year: number | null;
  iban: string | null;
  bic: string | null;
  payroll_tax_credit: boolean | null;
  special_arrangement: string | null;
  liability_policy_number: string | null;
  accident_policy_number: string | null;
  insurance_notes: string | null;
  arbo_check_date: string | null;
  medical_exam_date: string | null;
  safety_instructions_signed: boolean | null;
  arbo_notes: string | null;
};

type EmployeeRate = {
  id: string;
  employee_id: string;
  name: string;
  hourly_rate: number;
  is_default: boolean;
  sort_order: number;
};

const empty = {
  first_name: "",
  middle_name: "",
  last_name: "",
  role: "medewerker",
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
  contract_type: "",
  start_date: "",
  probation_end_date: "",
  end_date: "",
  hours_per_week: "",
  work_days: "",
  hourly_rate: "",
  monthly_salary: "",
  vacation_days_per_year: "20",
  iban: "",
  bic: "",
  payroll_tax_credit: false,
  special_arrangement: "",
  liability_policy_number: "",
  accident_policy_number: "",
  insurance_notes: "",
  arbo_check_date: "",
  medical_exam_date: "",
  safety_instructions_signed: false,
  arbo_notes: "",
};

function num(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

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
  const [docsFor, setDocsFor] = useState<Employee | null>(null);
  const [rates, setRates] = useState<EmployeeRate[]>([]);
  const [newRate, setNewRate] = useState({ name: "", hourly_rate: "", is_default: false });

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
    setRates([]);
    setOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      first_name: e.first_name ?? "",
      middle_name: e.middle_name ?? "",
      last_name: e.last_name ?? "",
      role: e.role ?? "medewerker",
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
      contract_type: e.contract_type ?? "",
      start_date: e.start_date ?? "",
      probation_end_date: e.probation_end_date ?? "",
      end_date: e.end_date ?? "",
      hours_per_week: e.hours_per_week?.toString() ?? "",
      work_days: e.work_days ?? "",
      hourly_rate: e.hourly_rate?.toString() ?? "",
      monthly_salary: e.monthly_salary?.toString() ?? "",
      vacation_days_per_year: e.vacation_days_per_year?.toString() ?? "20",
      iban: e.iban ?? "",
      bic: e.bic ?? "",
      payroll_tax_credit: e.payroll_tax_credit ?? false,
      special_arrangement: e.special_arrangement ?? "",
      liability_policy_number: e.liability_policy_number ?? "",
      accident_policy_number: e.accident_policy_number ?? "",
      insurance_notes: e.insurance_notes ?? "",
      arbo_check_date: e.arbo_check_date ?? "",
      medical_exam_date: e.medical_exam_date ?? "",
      safety_instructions_signed: e.safety_instructions_signed ?? false,
      arbo_notes: e.arbo_notes ?? "",
    });
    loadRates(e.id);
    setOpen(true);
  }

  async function loadRates(employeeId: string) {
    const { data, error } = await supabase
      .from("employee_rates")
      .select("*")
      .eq("employee_id", employeeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast.error("Kon tarieven niet laden");
      return;
    }
    setRates((data ?? []) as EmployeeRate[]);
    const first = (data ?? [])[0] as EmployeeRate | undefined;
    setNewRate({
      name: "",
      hourly_rate: first ? String(first.hourly_rate) : "",
      is_default: true,
    });
  }

  async function addRate() {
    if (!user || !editing) {
      toast.error("Sla eerst de medewerker op voordat je tarieven toevoegt");
      return;
    }
    const naam = [form.first_name, form.middle_name, form.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const tarief = num(newRate.hourly_rate);
    if (!naam || tarief == null) {
      toast.error("Vul eerst de naam van de medewerker en een uurtarief in");
      return;
    }
    // Eén tarief per medewerker: bestaande tarieven verwijderen en nieuwe opslaan.
    await supabase.from("employee_rates").delete().eq("employee_id", editing.id);
    const { error } = await supabase.from("employee_rates").insert({
      user_id: user.id,
      employee_id: editing.id,
      name: naam,
      hourly_rate: tarief,
      is_default: true,
      sort_order: 0,
    });
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    toast.success("Tarief opgeslagen");
    loadRates(editing.id);
  }

  async function setDefaultRate(id: string) {
    if (!editing) return;
    await supabase
      .from("employee_rates")
      .update({ is_default: false })
      .eq("employee_id", editing.id);
    await supabase.from("employee_rates").update({ is_default: true }).eq("id", id);
    loadRates(editing.id);
  }

  async function deleteRate(id: string) {
    if (!editing) return;
    const { error } = await supabase.from("employee_rates").delete().eq("id", id);
    if (error) {
      toast.error("Verwijderen mislukt");
      return;
    }
    loadRates(editing.id);
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
      role: form.role,
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
      contract_type: form.contract_type.trim() || null,
      start_date: form.start_date || null,
      probation_end_date: form.probation_end_date || null,
      end_date: form.end_date || null,
      hours_per_week: num(form.hours_per_week),
      work_days: form.work_days.trim() || null,
      hourly_rate: num(form.hourly_rate),
      monthly_salary: num(form.monthly_salary),
      vacation_days_per_year: num(form.vacation_days_per_year),
      iban: form.iban.trim() || null,
      bic: form.bic.trim() || null,
      payroll_tax_credit: form.payroll_tax_credit,
      special_arrangement: form.special_arrangement.trim() || null,
      liability_policy_number: form.liability_policy_number.trim() || null,
      accident_policy_number: form.accident_policy_number.trim() || null,
      insurance_notes: form.insurance_notes.trim() || null,
      arbo_check_date: form.arbo_check_date || null,
      medical_exam_date: form.medical_exam_date || null,
      safety_instructions_signed: form.safety_instructions_signed,
      arbo_notes: form.arbo_notes.trim() || null,
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

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm({ ...form, [k]: v });

  return (
    <AppShell title="Medewerkers" subtitle="HR-dossier en personeelsgegevens" back>
      <div className="mb-6 flex items-center justify-end">
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
                  <TableHead>Rol</TableHead>
                  <TableHead>Functie</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Mobiel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {[e.first_name, e.middle_name, e.last_name].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.role === "eigenaar" ? "default" : "outline"}>
                        {e.role === "eigenaar" ? "Eigenaar" : "Medewerker"}
                      </Badge>
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
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Documenten"
                          onClick={() => setDocsFor(e)}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Medewerker bewerken" : "Nieuwe medewerker"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="persoonlijk" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="persoonlijk">Persoonlijk</TabsTrigger>
              <TabsTrigger value="arbeid">Arbeid</TabsTrigger>
              <TabsTrigger value="loon">Loon</TabsTrigger>
              <TabsTrigger value="tarieven">Tarieven</TabsTrigger>
              <TabsTrigger value="arbo">Verzekering & Arbo</TabsTrigger>
            </TabsList>

            {/* PERSOONLIJK */}
            <TabsContent value="persoonlijk" className="space-y-4 pt-4">
              <div>
                <Label>Rol</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                >
                  <option value="medewerker">Medewerker</option>
                  <option value="eigenaar">Eigenaar</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Voornaam *</Label>
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </div>
                <div>
                  <Label>Tussenvoegsel</Label>
                  <Input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
                </div>
                <div>
                  <Label>Achternaam *</Label>
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>BSN</Label>
                  <Input value={form.bsn} onChange={(e) => set("bsn", e.target.value)} placeholder="9 cijfers" />
                </div>
                <div>
                  <Label>Geboortedatum</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <div>
                  <Label>Straat</Label>
                  <Input value={form.street} onChange={(e) => set("street", e.target.value)} />
                </div>
                <div>
                  <Label>Huisnr.</Label>
                  <Input value={form.house_number} onChange={(e) => set("house_number", e.target.value)} />
                </div>
                <div>
                  <Label>Toevoeging</Label>
                  <Input value={form.house_number_addition} onChange={(e) => set("house_number_addition", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Postcode</Label>
                  <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
                </div>
                <div>
                  <Label>Plaats</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Telefoon</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label>Mobiel</Label>
                  <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Notities</Label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
              </div>
            </TabsContent>

            {/* ARBEID */}
            <TabsContent value="arbeid" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Functie</Label>
                  <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="bv. Stucadoor" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    <option value="actief">Actief</option>
                    <option value="uit_dienst">Uit dienst</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Contracttype</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.contract_type}
                    onChange={(e) => set("contract_type", e.target.value)}
                  >
                    <option value="">— kies —</option>
                    <option value="onbepaalde_tijd">Onbepaalde tijd</option>
                    <option value="bepaalde_tijd">Bepaalde tijd</option>
                    <option value="oproep">Oproep / nul-uren</option>
                    <option value="zzp">ZZP / inhuur</option>
                    <option value="uitzend">Uitzendkracht</option>
                    <option value="stage">Stage</option>
                  </select>
                </div>
                <div>
                  <Label>Vakantiedagen per jaar (fulltime)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.vacation_days_per_year}
                    onChange={(e) => set("vacation_days_per_year", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Startdatum</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
                </div>
                <div>
                  <Label>Einde proeftijd</Label>
                  <Input type="date" value={form.probation_end_date} onChange={(e) => set("probation_end_date", e.target.value)} />
                </div>
                <div>
                  <Label>Einddatum (indien bepaald)</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Uren per week</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.hours_per_week}
                    onChange={(e) => set("hours_per_week", e.target.value)}
                    placeholder="bv. 40"
                  />
                </div>
                <div>
                  <Label>Werkdagen</Label>
                  <Input
                    value={form.work_days}
                    onChange={(e) => set("work_days", e.target.value)}
                    placeholder="bv. ma-di-wo-do-vr"
                  />
                </div>
              </div>
            </TabsContent>

            {/* LOON */}
            <TabsContent value="loon" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Uurtarief (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.hourly_rate}
                    onChange={(e) => set("hourly_rate", e.target.value)}
                    placeholder="bv. 28,50"
                  />
                </div>
                <div>
                  <Label>Maandsalaris (€, bruto)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.monthly_salary}
                    onChange={(e) => set("monthly_salary", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>IBAN</Label>
                  <Input
                    value={form.iban}
                    onChange={(e) => set("iban", e.target.value.toUpperCase())}
                    placeholder="NL00 BANK 0123 4567 89"
                  />
                </div>
                <div>
                  <Label>BIC (optioneel)</Label>
                  <Input value={form.bic} onChange={(e) => set("bic", e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border p-3">
                <input
                  id="payroll_tax_credit"
                  type="checkbox"
                  checked={form.payroll_tax_credit}
                  onChange={(e) => set("payroll_tax_credit", e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="payroll_tax_credit" className="cursor-pointer font-normal">
                  Loonheffingskorting toepassen
                </Label>
              </div>

              <div>
                <Label>Bijzondere regeling (bv. 30%-regeling, ET-regeling)</Label>
                <Textarea
                  value={form.special_arrangement}
                  onChange={(e) => set("special_arrangement", e.target.value)}
                  rows={2}
                />
              </div>
            </TabsContent>

            {/* TARIEVEN */}
            <TabsContent value="tarieven" className="space-y-4 pt-4">
              {!editing ? (
                <p className="text-sm text-muted-foreground">
                  Sla eerst de medewerker op. Daarna kun je hier meerdere uurtarieven beheren
                  (bv. Stucwerk, Schilderwerk).
                </p>
              ) : (
                <>
                  <div className="rounded-md border p-3">
                    <h4 className="mb-1 text-sm font-semibold">Verkooptarief medewerker</h4>
                    <p className="mb-3 text-xs text-muted-foreground">
                      BTW is altijd 21%. Vul het uurtarief excl. BTW in en sla op.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                       <div>
                         <Label>Naam</Label>
                         <Input
                           value={[form.first_name, form.middle_name, form.last_name]
                             .filter(Boolean)
                             .join(" ")
                             .trim()}
                           readOnly
                           className="bg-muted"
                         />
                       </div>
                      <div>
                        <Label>Uurtarief excl. BTW (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newRate.hourly_rate}
                          onChange={(e) =>
                            setNewRate({ ...newRate, hourly_rate: e.target.value })
                          }
                          placeholder="45,00"
                        />
                      </div>
                      <div>
                        <Label>BTW</Label>
                        <Input value="21%" readOnly className="bg-muted" />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addRate} className="w-full">
                          <Save className="mr-2 h-4 w-4" />
                          Opslaan
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* VERZEKERING & ARBO */}
            <TabsContent value="arbo" className="space-y-4 pt-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Verzekeringen</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>WA-polisnummer</Label>
                    <Input
                      value={form.liability_policy_number}
                      onChange={(e) => set("liability_policy_number", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ongevallen-polisnummer</Label>
                    <Input
                      value={form.accident_policy_number}
                      onChange={(e) => set("accident_policy_number", e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>Notitie verzekeringen</Label>
                  <Textarea
                    value={form.insurance_notes}
                    onChange={(e) => set("insurance_notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-semibold">Arbo</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Datum arbo-check</Label>
                    <Input
                      type="date"
                      value={form.arbo_check_date}
                      onChange={(e) => set("arbo_check_date", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Datum medische keuring</Label>
                    <Input
                      type="date"
                      value={form.medical_exam_date}
                      onChange={(e) => set("medical_exam_date", e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-md border p-3">
                  <input
                    id="safety_instructions"
                    type="checkbox"
                    checked={form.safety_instructions_signed}
                    onChange={(e) => set("safety_instructions_signed", e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="safety_instructions" className="cursor-pointer font-normal">
                    Veiligheidsinstructies ondertekend
                  </Label>
                </div>

                <div className="mt-3">
                  <Label>Notitie arbo</Label>
                  <Textarea
                    value={form.arbo_notes}
                    onChange={(e) => set("arbo_notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

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

      <EmployeeDocumentsDialog
        employeeId={docsFor?.id ?? null}
        employeeName={
          docsFor
            ? [docsFor.first_name, docsFor.middle_name, docsFor.last_name]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        open={!!docsFor}
        onOpenChange={(o) => !o && setDocsFor(null)}
      />
    </AppShell>
  );
}
