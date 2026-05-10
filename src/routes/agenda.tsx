import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
});

type Employee = { id: string; first_name: string; last_name: string };
type Leave = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
};

type ViewMode = "day" | "week" | "year";

const DAY_NAMES = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTH_NAMES = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 7..20 (block start)
const ABSENT_TYPES = new Set(["vakantie", "ziek", "bijzonder", "onbetaald", "feestdag"]);

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=zo, 1=ma
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function isoWeek(d: Date): { week: number; year: number } {
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

function AgendaPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [yearOpen, setYearOpen] = useState(false);
  const [yearInput, setYearInput] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    const [emp, lr] = await Promise.all([
      supabase.from("employees").select("id,first_name,last_name").eq("status", "actief").order("last_name"),
      supabase.from("leave_requests").select("id,employee_id,leave_type,start_date,end_date,status"),
    ]);
    setEmployees((emp.data ?? []) as Employee[]);
    setLeaves((lr.data ?? []) as Leave[]);
  }

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]); // ma..za
  const { week, year } = useMemo(() => isoWeek(anchor), [anchor]);

  function isAbsent(empId: string, day: Date): Leave | null {
    const dStr = ymd(day);
    return (
      leaves.find(
        (l) =>
          l.employee_id === empId &&
          l.status === "goedgekeurd" &&
          ABSENT_TYPES.has(l.leave_type) &&
          l.start_date <= dStr &&
          l.end_date >= dStr,
      ) ?? null
    );
  }

  function availableFor(day: Date) {
    return employees.filter((e) => !isAbsent(e.id, day));
  }
  function absentFor(day: Date) {
    return employees
      .map((e) => ({ emp: e, leave: isAbsent(e.id, day) }))
      .filter((x) => x.leave) as { emp: Employee; leave: Leave }[];
  }

  function shift(days: number) {
    setAnchor((a) => addDays(a, days));
  }
  function gotoToday() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setAnchor(t);
  }

  const headerTitle = useMemo(() => {
    if (view === "day") {
      return `Planning (${DAY_NAMES[anchor.getDay()]} ${anchor.getDate()} ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()})`;
    }
    if (view === "year") {
      return `Planning (jaar ${anchor.getFullYear()})`;
    }
    return `Planning (week ${week} - ${year})`;
  }, [view, anchor, week, year]);

  return (
    <AppShell title="Agenda" subtitle="Weekplanning en beschikbaarheid" back>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => shift(view === "day" ? -1 : view === "week" ? -7 : -365)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">{headerTitle}</h2>
            <Button variant="ghost" size="icon" onClick={() => shift(view === "day" ? 1 : view === "week" ? 7 : 365)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={gotoToday}>Vandaag</Button>
            <Button size="sm" variant={view === "day" ? "default" : "outline"} onClick={() => setView("day")}>Dag</Button>
            <Button size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>Week</Button>
            <Button size="sm" variant={view === "year" ? "default" : "outline"} onClick={() => setView("year")}>Jaar</Button>
            <Button size="sm" variant="outline" onClick={() => { setYearInput(String(anchor.getFullYear())); setYearOpen(true); }}>
              Ga naar jaar...
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === "week" && (
        <WeekGrid days={weekDays} availableFor={availableFor} absentFor={absentFor} />
      )}
      {view === "day" && (
        <WeekGrid days={[anchor]} availableFor={availableFor} absentFor={absentFor} />
      )}
      {view === "year" && (
        <YearView
          year={anchor.getFullYear()}
          onPickWeek={(w) => { setAnchor(dateOfIsoWeek(w, anchor.getFullYear())); setView("week"); }}
        />
      )}

      <Dialog open={yearOpen} onOpenChange={setYearOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ga naar jaar</DialogTitle></DialogHeader>
          <Input type="number" value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearOpen(false)}>Annuleren</Button>
            <Button
              onClick={() => {
                const y = parseInt(yearInput, 10);
                if (!isNaN(y)) {
                  const d = new Date(y, anchor.getMonth(), 1);
                  setAnchor(d);
                  setView("year");
                }
                setYearOpen(false);
              }}
            >Open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function WeekGrid({
  days,
  availableFor,
  absentFor,
}: {
  days: Date[];
  availableFor: (d: Date) => Employee[];
  absentFor: (d: Date) => { emp: Employee; leave: Leave }[];
}) {
  const todayStr = ymd(new Date());
  const cols = days.length;
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[800px]">
          {/* Header per day */}
          <div
            className="grid border-b bg-muted/40"
            style={{ gridTemplateColumns: `80px repeat(${cols}, minmax(0,1fr))` }}
          >
            <div className="p-2 text-xs font-medium text-muted-foreground">Tijd</div>
            {days.map((d) => {
              const isToday = ymd(d) === todayStr;
              const avail = availableFor(d);
              const absent = absentFor(d);
              return (
                <div key={d.toISOString()} className={`border-l p-2 ${isToday ? "bg-primary/5" : ""}`}>
                  <div className="text-sm font-semibold">
                    {DAY_NAMES[d.getDay()]}. {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {avail.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Niemand beschikbaar</span>
                    ) : (
                      avail.map((e) => (
                        <Badge key={e.id} variant="secondary" className="text-[10px]">
                          {e.first_name} {e.last_name[0]}.
                        </Badge>
                      ))
                    )}
                  </div>
                  {absent.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {absent.map(({ emp, leave }) => (
                        <Badge key={emp.id} variant="destructive" className="text-[10px]">
                          {emp.first_name} {emp.last_name[0]}. — {leave.leave_type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="grid border-b"
              style={{ gridTemplateColumns: `80px repeat(${cols}, minmax(0,1fr))` }}
            >
              <div className="p-2 text-xs text-muted-foreground">
                {String(h).padStart(2, "0")}:00 - {String(h + 1).padStart(2, "0")}:00
              </div>
              {days.map((d) => (
                <div key={d.toISOString() + h} className="min-h-[44px] border-l" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function YearView({ year, onPickWeek }: { year: number; onPickWeek: (week: number) => void }) {
  // 53 weeks max
  const weeks = Array.from({ length: 53 }, (_, i) => i + 1).filter((w) => {
    const d = dateOfIsoWeek(w, year);
    return isoWeek(d).year === year;
  });
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {weeks.map((w) => {
            const d = dateOfIsoWeek(w, year);
            return (
              <button
                key={w}
                onClick={() => onPickWeek(w)}
                className="rounded-md border p-2 text-left transition-colors hover:bg-accent"
              >
                <div className="text-sm font-semibold">Week {w}</div>
                <div className="text-xs text-muted-foreground">
                  {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
