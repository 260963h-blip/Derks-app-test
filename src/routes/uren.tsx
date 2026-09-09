import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/uren")({
  component: UrenPage,
});

type Employee = { id: string; first_name: string; last_name: string };
type Customer = { id: string; name: string };

type TimeEntry = {
  id: string;
  employee_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  hours: number;
  entry_type: string;
  customer_id: string | null;
  project: string | null;
  description: string | null;
  status: string;
};

const ENTRY_TYPES = [
  { value: "regulier", label: "Regulier" },
  { value: "overwerk", label: "Overwerk" },
  { value: "reistijd", label: "Reistijd" },
  { value: "opleiding", label: "Opleiding" },
];

const STATUS = [
  { value: "concept", label: "Concept" },
  { value: "ingediend", label: "Ingediend" },
  { value: "goedgekeurd", label: "Goedgekeurd" },
  { value: "afgekeurd", label: "Afgekeurd" },
];

type ClockEntry = {
  id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
};

function calcHours(start: string, end: string, breakMin: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm) - (breakMin || 0);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clockHours(entry: ClockEntry): number {
  if (!entry.clock_out_at) return 0;
  const ms = new Date(entry.clock_out_at).getTime() - new Date(entry.clock_in_at).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100);
}


function UrenPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [toDelete, setToDelete] = useState<TimeEntry | null>(null);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [clockOpen, setClockOpen] = useState(false);
  const [clockEditing, setClockEditing] = useState<ClockEntry | null>(null);
  const [clockForm, setClockForm] = useState({ employee_id: "", clock_in_at: "", clock_out_at: "" });
  const [form, setForm] = useState({
    employee_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    start_time: "08:00",
    end_time: "17:00",
    break_minutes: "30",
    entry_type: "regulier",
    customer_id: "",
    project: "",
    description: "",
    status: "concept",
  });

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [emp, cus, te] = await Promise.all([
      supabase.from("employees").select("id,first_name,last_name").order("last_name"),
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("time_entries").select("*").order("work_date", { ascending: false }).limit(500),
    ]);
    if (emp.error) toast.error(emp.error.message);
    else setEmployees(emp.data ?? []);
    if (cus.error) toast.error(cus.error.message);
    else setCustomers(cus.data ?? []);
    if (te.error) toast.error(te.error.message);
    else setEntries((te.data ?? []) as TimeEntry[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () => (filterEmp === "all" ? entries : entries.filter((e) => e.employee_id === filterEmp)),
    [entries, filterEmp],
  );

  const totalHours = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.hours || 0), 0),
    [filtered],
  );

  function openNew() {
    setEditing(null);
    setForm({
      employee_id: employees[0]?.id ?? "",
      work_date: new Date().toISOString().slice(0, 10),
      start_time: "08:00",
      end_time: "17:00",
      break_minutes: "30",
      entry_type: "regulier",
      customer_id: "",
      project: "",
      description: "",
      status: "concept",
    });
    setOpen(true);
  }

  function openEdit(e: TimeEntry) {
    setEditing(e);
    setForm({
      employee_id: e.employee_id,
      work_date: e.work_date,
      start_time: e.start_time ?? "",
      end_time: e.end_time ?? "",
      break_minutes: String(e.break_minutes ?? 0),
      entry_type: e.entry_type,
      customer_id: e.customer_id ?? "",
      project: e.project ?? "",
      description: e.description ?? "",
      status: e.status,
    });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.employee_id) {
      toast.error("Selecteer een medewerker");
      return;
    }
    const breakMin = parseInt(form.break_minutes || "0", 10) || 0;
    const hours = calcHours(form.start_time, form.end_time, breakMin);
    const payload = {
      user_id: user.id,
      employee_id: form.employee_id,
      work_date: form.work_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      break_minutes: breakMin,
      hours,
      entry_type: form.entry_type,
      customer_id: form.customer_id || null,
      project: form.project || null,
      description: form.description || null,
      status: form.status,
    };
    const res = editing
      ? await supabase.from("time_entries").update(payload).eq("id", editing.id)
      : await supabase.from("time_entries").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(editing ? "Bijgewerkt" : "Toegevoegd");
    setOpen(false);
    void loadAll();
  }

  async function doDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("time_entries").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verwijderd");
    setToDelete(null);
    void loadAll();
  }

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };
  const cusName = (id: string | null) => customers.find((x) => x.id === id)?.name ?? "";

  const liveHours = calcHours(form.start_time, form.end_time, parseInt(form.break_minutes || "0", 10) || 0);

  return (
    <AppShell title="Urenregistratie" subtitle="Gewerkte uren per medewerker" back>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle medewerkers</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary">Totaal: {totalHours.toFixed(2)} uur</Badge>
        <div className="ml-auto">
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Uren toevoegen</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nog geen uren geregistreerd</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Medewerker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Klant / Project</TableHead>
                  <TableHead>Begin</TableHead>
                  <TableHead>Eind</TableHead>
                  <TableHead>Pauze</TableHead>
                  <TableHead className="text-right">Uren</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.work_date}</TableCell>
                    <TableCell>{empName(e.employee_id)}</TableCell>
                    <TableCell><Badge variant="outline">{e.entry_type}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {cusName(e.customer_id)}
                      {e.project ? <span className="text-muted-foreground"> · {e.project}</span> : null}
                    </TableCell>
                    <TableCell>{e.start_time?.slice(0, 5) ?? "—"}</TableCell>
                    <TableCell>{e.end_time?.slice(0, 5) ?? "—"}</TableCell>
                    <TableCell>{e.break_minutes} min</TableCell>
                    <TableCell className="text-right font-medium">{Number(e.hours).toFixed(2)}</TableCell>
                    <TableCell><Badge>{e.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(e)}>
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
            <DialogTitle>{editing ? "Uren bewerken" : "Uren toevoegen"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Medewerker *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Kies..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.entry_type} onValueChange={(v) => setForm({ ...form, entry_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Begintijd</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Eindtijd</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pauze (minuten)</Label>
              <Input type="number" min="0" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Berekende uren</Label>
              <Input value={liveHours.toFixed(2)} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select value={form.customer_id || "none"} onValueChange={(v) => setForm({ ...form, customer_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— geen —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Omschrijving</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={save}>{editing ? "Bijwerken" : "Toevoegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Urenregistratie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze actie kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
