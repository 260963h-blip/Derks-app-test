import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
});

type Employee = { id: string; first_name: string; last_name: string; role?: string };
type Leave = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
};
type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  customer_id: string | null;
};
type Customer = {
  id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  house_number_addition: string | null;
  postal_code: string | null;
  city: string | null;
};
type Planning = {
  id: string;
  project_id: string;
  work_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  employee_ids: string[];
  notes: string | null;
};

type ViewMode = "day" | "week" | "year";

const DAY_NAMES = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTH_NAMES = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i);
const ABSENT_TYPES = new Set(["vakantie", "ziek", "bijzonder", "onbetaald", "feestdag"]);

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function ymd(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: t.getUTCFullYear() };
}
function dateOfIsoWeek(week: number, year: number) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
}
function hourOfTime(t: string) { return parseInt(t.slice(0, 2), 10); }

function AgendaPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => { const t = new Date(); t.setHours(0,0,0,0); return t; });
  const [yearOpen, setYearOpen] = useState(false);
  const [yearInput, setYearInput] = useState<string>(String(new Date().getFullYear()));

  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState<Planning | null>(null);
  const [toDelete, setToDelete] = useState<Planning | null>(null);
  const [form, setForm] = useState({
    project_id: "",
    work_date: ymd(new Date()),
    end_date: ymd(new Date()),
    start_time: "07:00",
    end_time: "17:00",
    employee_ids: [] as string[],
    notes: "",
  });

  useEffect(() => { if (user) void load(); }, [user]);

  async function load() {
    const [emp, lr, pr, pl, cu] = await Promise.all([
      supabase.from("employees").select("id,first_name,last_name,role").eq("status", "actief").order("last_name"),
      supabase.from("leave_requests").select("id,employee_id,leave_type,start_date,end_date,status"),
      supabase.from("projects").select("id,project_number,title,status,customer_id").in("status", ["akkoord","in_uitvoering"]).order("project_number", { ascending: false }),
      supabase.from("planning_items").select("*").order("work_date"),
      supabase.from("customers").select("id,name,street,house_number,house_number_addition,postal_code,city"),
    ]);
    setEmployees((emp.data ?? []) as Employee[]);
    setLeaves((lr.data ?? []) as Leave[]);
    setProjects((pr.data ?? []) as Project[]);
    setPlannings((pl.data ?? []) as Planning[]);
    setCustomers((cu.data ?? []) as Customer[]);
  }

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { week, year } = useMemo(() => isoWeek(anchor), [anchor]);

  function isAbsent(empId: string, day: Date): Leave | null {
    const d = ymd(day);
    return leaves.find((l) => l.employee_id === empId && l.status === "goedgekeurd" && ABSENT_TYPES.has(l.leave_type) && l.start_date <= d && l.end_date >= d) ?? null;
  }
  const availableFor = (d: Date) => employees.filter((e) => !isAbsent(e.id, d));
  const absentFor = (d: Date) => employees.map((e) => ({ emp: e, leave: isAbsent(e.id, d) })).filter((x) => x.leave) as { emp: Employee; leave: Leave }[];
  const planningsFor = (d: Date) => {
    const s = ymd(d);
    return plannings.filter((p) => p.work_date <= s && (p.end_date ?? p.work_date) >= s);
  };
  const projectFor = (id: string) => projects.find((p) => p.id === id);
  const addressFor = (projectId: string) => {
    const p = projectFor(projectId);
    if (!p?.customer_id) return "";
    const c = customers.find((x) => x.id === p.customer_id);
    if (!c) return "";
    const street = [c.street, c.house_number, c.house_number_addition].filter(Boolean).join(" ");
    const place = [c.postal_code, c.city].filter(Boolean).join(" ");
    return [street, place].filter(Boolean).join(", ");
  };
  const empName = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.first_name} ${e.last_name[0]}.` : "?"; };

  function openNew(date?: Date) {
    setEditing(null);
    const start = ymd(date ?? anchor);
    setForm({
      project_id: projects[0]?.id ?? "",
      work_date: start,
      end_date: start,
      start_time: "07:00",
      end_time: "17:00",
      employee_ids: [],
      notes: "",
    });
    setPlanOpen(true);
  }
  function openEdit(p: Planning) {
    setEditing(p);
    setForm({
      project_id: p.project_id,
      work_date: p.work_date,
      end_date: p.end_date ?? p.work_date,
      start_time: p.start_time.slice(0,5),
      end_time: p.end_time.slice(0,5),
      employee_ids: p.employee_ids ?? [],
      notes: p.notes ?? "",
    });
    setPlanOpen(true);
  }
  async function savePlan() {
    if (!user) return;
    if (!form.project_id) { toast.error("Kies een project"); return; }
    if (form.employee_ids.length === 0) { toast.error("Kies minimaal één medewerker"); return; }
    if (form.end_time <= form.start_time) { toast.error("Eindtijd moet na starttijd liggen"); return; }
    if (form.end_date < form.work_date) { toast.error("Einddatum kan niet voor startdatum liggen"); return; }
    const payload = {
      user_id: user.id,
      project_id: form.project_id,
      work_date: form.work_date,
      end_date: form.end_date,
      start_time: form.start_time,
      end_time: form.end_time,
      employee_ids: form.employee_ids,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from("planning_items").update(payload).eq("id", editing.id)
      : await supabase.from("planning_items").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    // Zet projectstatus op 'in_uitvoering' als die nog op 'akkoord' staat
    const proj = projectFor(form.project_id);
    if (proj && proj.status === "akkoord") {
      await supabase.from("projects").update({ status: "in_uitvoering" }).eq("id", proj.id);
    }
    toast.success(editing ? "Bijgewerkt" : "Gepland");
    setPlanOpen(false);
    void load();
  }
  async function doDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("planning_items").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Verwijderd");
    setToDelete(null);
    void load();
  }
  function toggleEmp(id: string) {
    setForm((f) => f.employee_ids.includes(id) ? { ...f, employee_ids: f.employee_ids.filter((x)=>x!==id) } : { ...f, employee_ids: [...f.employee_ids, id] });
  }

  function shift(days: number) { setAnchor((a) => addDays(a, days)); }
  function gotoToday() { const t = new Date(); t.setHours(0,0,0,0); setAnchor(t); }

  const headerTitle = useMemo(() => {
    if (view === "day") return `Planning (${DAY_NAMES[anchor.getDay()]} ${anchor.getDate()} ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()})`;
    if (view === "year") return `Planning (jaar ${anchor.getFullYear()})`;
    return `Planning (week ${week} - ${year})`;
  }, [view, anchor, week, year]);

  const days = view === "day" ? [anchor] : weekDays;

  return (
    <AppShell title="Agenda" subtitle="Weekplanning en beschikbaarheid" back>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => shift(view === "day" ? -1 : view === "week" ? -7 : -365)}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold">{headerTitle}</h2>
            <Button variant="ghost" size="icon" onClick={() => shift(view === "day" ? 1 : view === "week" ? 7 : 365)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => openNew()}><Plus className="mr-1 h-4 w-4" /> Project plannen</Button>
            <Button size="sm" variant="outline" onClick={gotoToday}>Vandaag</Button>
            <Button size="sm" variant={view === "day" ? "default" : "outline"} onClick={() => setView("day")}>Dag</Button>
            <Button size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>Week</Button>
            <Button size="sm" variant={view === "year" ? "default" : "outline"} onClick={() => setView("year")}>Jaar</Button>
            <Button size="sm" variant="outline" onClick={() => { setYearInput(String(anchor.getFullYear())); setYearOpen(true); }}>Ga naar jaar...</Button>
          </div>
        </CardContent>
      </Card>

      {view !== "year" ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="min-w-[800px]">
              <div className="grid border-b bg-muted/40" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(0,1fr))` }}>
                <div className="p-2 text-xs font-medium text-muted-foreground">Tijd</div>
                {days.map((d) => {
                  const isToday = ymd(d) === ymd(new Date());
                  const avail = availableFor(d);
                  const absent = absentFor(d);
                  return (
                    <div key={d.toISOString()} className={`border-l p-2 ${isToday ? "bg-primary/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{DAY_NAMES[d.getDay()]}. {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}</div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openNew(d)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {avail.length === 0 ? <span className="text-xs text-muted-foreground">Niemand beschikbaar</span> : avail.map((e) => (
                          <Badge key={e.id} variant="secondary" className="text-[10px]">{e.first_name} {e.last_name[0]}.</Badge>
                        ))}
                      </div>
                      {absent.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {absent.map(({ emp, leave }) => (
                            <Badge key={emp.id} variant="destructive" className="text-[10px]">{emp.first_name} {emp.last_name[0]}. — {leave.leave_type}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {HOURS.map((h) => (
                <div key={h} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(0,1fr))` }}>
                  <div className="p-2 text-xs text-muted-foreground">{String(h).padStart(2,'0')}:00 - {String(h+1).padStart(2,'0')}:00</div>
                  {days.map((d) => {
                    const items = planningsFor(d).filter((p) => hourOfTime(p.start_time) <= h && hourOfTime(p.end_time) > h);
                    return (
                      <div key={d.toISOString()+h} className="min-h-[44px] border-l p-1">
                        <div className="flex flex-col gap-1">
                          {items.map((p) => {
                            const proj = projectFor(p.project_id);
                            const isStart = hourOfTime(p.start_time) === h;
                            const addr = addressFor(p.project_id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => openEdit(p)}
                                className="rounded bg-primary/15 px-1 py-0.5 text-left text-[10px] hover:bg-primary/25"
                                title={`${proj?.project_number} ${proj?.title}${addr ? ` — ${addr}` : ""}`}
                              >
                                {isStart ? (
                                  <>
                                    <div className="truncate font-medium">{proj?.project_number} · {proj?.title}</div>
                                    {addr && <div className="truncate text-muted-foreground">{addr}</div>}
                                    <div className="truncate text-muted-foreground">{p.start_time.slice(0,5)}-{p.end_time.slice(0,5)} · {p.employee_ids.map(empName).join(", ")}</div>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">↑ {proj?.project_number}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 53 }, (_, i) => i + 1).filter((w) => isoWeek(dateOfIsoWeek(w, anchor.getFullYear())).year === anchor.getFullYear()).map((w) => {
                const d = dateOfIsoWeek(w, anchor.getFullYear());
                return (
                  <button key={w} onClick={() => { setAnchor(d); setView("week"); }} className="rounded-md border p-2 text-left transition-colors hover:bg-accent">
                    <div className="text-sm font-semibold">Week {w}</div>
                    <div className="text-xs text-muted-foreground">{d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Planning bewerken" : "Project plannen"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Project (akkoord) *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Kies project..." /></SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">Geen akkoord-projecten</div>
                  ) : projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number} — {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum *</Label>
              <div className="flex gap-2">
                <Input type="date" value={form.work_date} onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, work_date: v, end_date: f.end_date < v ? v : f.end_date }));
                }} />
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">Van — t/m (meerdere werkdagen mogelijk)</p>
            </div>
            <div className="space-y-2">
              <Label>Tijd</Label>
              <div className="flex gap-2">
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Uitvoerende medewerker(s) *</Label>
              <div className="flex flex-wrap gap-2 rounded-md border p-2">
                {employees.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Geen actieve medewerkers</span>
                ) : employees.map((e) => {
                  const sel = form.employee_ids.includes(e.id);
                  const roleLabel = e.role === "eigenaar" ? " (eigenaar)" : e.role === "zzp" || e.role === "zzper" || e.role === "zzp-er" ? " (ZZP)" : "";
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => toggleEmp(e.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${sel ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      {e.first_name} {e.last_name}{roleLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notities</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editing && (
                <Button variant="destructive" size="sm" onClick={() => { setPlanOpen(false); setToDelete(editing); }}>
                  <Trash2 className="mr-1 h-4 w-4" /> Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPlanOpen(false)}>Annuleren</Button>
              <Button onClick={savePlan}>{editing ? <><Pencil className="mr-1 h-4 w-4" /> Bijwerken</> : "Plannen"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yearOpen} onOpenChange={setYearOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ga naar jaar</DialogTitle></DialogHeader>
          <Input type="number" value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearOpen(false)}>Annuleren</Button>
            <Button onClick={() => { const y = parseInt(yearInput, 10); if (!isNaN(y)) { setAnchor(new Date(y, anchor.getMonth(), 1)); setView("year"); } setYearOpen(false); }}>Open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planning verwijderen?</AlertDialogTitle>
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
