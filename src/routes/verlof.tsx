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

export const Route = createFileRoute("/verlof")({
  component: VerlofPage,
});

type Employee = { id: string; first_name: string; last_name: string; vacation_days_per_year: number | null };

type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  notes: string | null;
};

const LEAVE_TYPES = [
  { value: "vakantie", label: "Vakantie" },
  { value: "ziek", label: "Ziekteverzuim" },
  { value: "bijzonder", label: "Bijzonder verlof" },
  { value: "feestdag", label: "Feestdag" },
  { value: "onbetaald", label: "Onbetaald verlof" },
];

const STATUS = [
  { value: "aangevraagd", label: "Aangevraagd" },
  { value: "goedgekeurd", label: "Goedgekeurd" },
  { value: "afgekeurd", label: "Afgekeurd" },
];

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function VerlofPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [toDelete, setToDelete] = useState<LeaveRequest | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "vakantie",
    start_date: today,
    end_date: today,
    reason: "",
    status: "aangevraagd",
    notes: "",
  });

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [emp, lr] = await Promise.all([
      supabase.from("employees").select("id,first_name,last_name,vacation_days_per_year").order("last_name"),
      supabase.from("leave_requests").select("*").order("start_date", { ascending: false }).limit(500),
    ]);
    if (emp.error) toast.error(emp.error.message);
    else setEmployees((emp.data ?? []) as Employee[]);
    if (lr.error) toast.error(lr.error.message);
    else setRequests((lr.data ?? []) as LeaveRequest[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () => (filterEmp === "all" ? requests : requests.filter((r) => r.employee_id === filterEmp)),
    [requests, filterEmp],
  );

  const balanceFor = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    const total = Number(emp?.vacation_days_per_year ?? 0);
    const year = new Date().getFullYear();
    const used = requests
      .filter(
        (r) =>
          r.employee_id === empId &&
          r.leave_type === "vakantie" &&
          r.status === "goedgekeurd" &&
          r.start_date.startsWith(String(year)),
      )
      .reduce((s, r) => s + Number(r.days || 0), 0);
    return { total, used, left: total - used };
  };

  function openNew() {
    setEditing(null);
    setForm({
      employee_id: employees[0]?.id ?? "",
      leave_type: "vakantie",
      start_date: today,
      end_date: today,
      reason: "",
      status: "aangevraagd",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(r: LeaveRequest) {
    setEditing(r);
    setForm({
      employee_id: r.employee_id,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      reason: r.reason ?? "",
      status: r.status,
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.employee_id) {
      toast.error("Selecteer een medewerker");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("Einddatum kan niet voor startdatum liggen");
      return;
    }
    const days = calcDays(form.start_date, form.end_date);
    const payload = {
      user_id: user.id,
      employee_id: form.employee_id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      reason: form.reason || null,
      status: form.status,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from("leave_requests").update(payload).eq("id", editing.id)
      : await supabase.from("leave_requests").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(editing ? "Bijgewerkt" : "Aangevraagd");
    setOpen(false);
    void loadAll();
  }

  async function doDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("leave_requests").delete().eq("id", toDelete.id);
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

  const liveDays = calcDays(form.start_date, form.end_date);
  const balance = filterEmp !== "all" ? balanceFor(filterEmp) : null;

  return (
    <AppShell title="Verlof" subtitle="Vakantie, ziekte en bijzonder verlof" back>
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
        {balance && (
          <div className="flex gap-2">
            <Badge variant="secondary">Recht: {balance.total} dagen</Badge>
            <Badge variant="outline">Opgenomen: {balance.used}</Badge>
            <Badge>Resterend: {balance.left}</Badge>
          </div>
        )}
        <div className="ml-auto">
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Verlof aanvragen</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nog geen verlofaanvragen</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medewerker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Van</TableHead>
                  <TableHead>Tot</TableHead>
                  <TableHead className="text-right">Dagen</TableHead>
                  <TableHead>Reden</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{empName(r.employee_id)}</TableCell>
                    <TableCell><Badge variant="outline">{r.leave_type}</Badge></TableCell>
                    <TableCell>{r.start_date}</TableCell>
                    <TableCell>{r.end_date}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.days).toFixed(1)}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{r.reason}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(r)}>
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
            <DialogTitle>{editing ? "Verlof bewerken" : "Verlof aanvragen"}</DialogTitle>
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
              <Label>Type verlof</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Startdatum *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Einddatum *</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
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
              <Label>Werkdagen (excl. weekend)</Label>
              <Input value={liveDays} readOnly />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reden</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Opmerkingen</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={save}>{editing ? "Bijwerken" : "Opslaan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlofaanvraag verwijderen?</AlertDialogTitle>
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
