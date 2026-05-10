import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, Package, UserCog, Building2, LogOut, Clock, CalendarDays, Settings, FolderKanban, Calendar } from "lucide-react";
import logo from "@/assets/logo-derks.png";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const menu: Array<{
  title: string;
  desc: string;
  icon: typeof FileText;
  to?: string;
}> = [
  { title: "Projecten", desc: "Projecten met offerte, werkorder en factuur", icon: FolderKanban, to: "/projecten" },
  { title: "Agenda", desc: "Weekplanning en beschikbaarheid", icon: Calendar, to: "/agenda" },
  { title: "Facturen", desc: "Facturen en UBL/XML-export", icon: Receipt },
  { title: "Klanten", desc: "Klantgegevens beheren", icon: Users, to: "/klanten" },
  { title: "Artikelen", desc: "Materialen en werkzaamheden", icon: Package, to: "/artikelen" },
  { title: "Medewerkers", desc: "HR-dossier en personeelsgegevens", icon: UserCog, to: "/medewerkers" },
  { title: "Urenregistratie", desc: "Gewerkte uren per medewerker", icon: Clock, to: "/uren" },
  { title: "Verlof", desc: "Vakantie, ziekte en bijzonder verlof", icon: CalendarDays, to: "/verlof" },
  { title: "Bedrijfsgegevens", desc: "Eigen bedrijfsinformatie", icon: Building2, to: "/bedrijfsgegevens" },
  { title: "Instellingen", desc: "Categorieën en eenheden beheren", icon: Settings, to: "/instellingen" },
];

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [logEntries, setLogEntries] = useState<Array<{
    id: string;
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    employee_name?: string;
  }>>([]);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tefactureren, setTefactureren] = useState<Array<{
    id: string;
    project_number: string;
    title: string;
    updated_at: string;
    customer_name?: string;
  }>>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadLog();
    void loadTefactureren();
  }, [user]);

  async function loadLog() {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id,employee_id,leave_type,start_date,end_date,days,reason,status,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = data ?? [];
    const empIds = Array.from(new Set(rows.map((r) => r.employee_id)));
    let names: Record<string, string> = {};
    if (empIds.length) {
      const { data: emps } = await supabase
        .from("employees")
        .select("id,first_name,last_name")
        .in("id", empIds);
      names = Object.fromEntries((emps ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
    }
    setLogEntries(rows.map((r) => ({ ...r, employee_name: names[r.employee_id] ?? "—" })));
  }

  async function loadTefactureren() {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,updated_at,customer_id")
      .eq("status", "te_factureren")
      .order("updated_at", { ascending: false });
    if (error) return;
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: cs } = await supabase.from("customers").select("id,name").in("id", ids);
      names = Object.fromEntries((cs ?? []).map((c) => [c.id, c.name]));
    }
    setTefactureren(rows.map((r) => ({
      id: r.id,
      project_number: r.project_number,
      title: r.title,
      updated_at: r.updated_at,
      customer_name: r.customer_id ? names[r.customer_id] : undefined,
    })));
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "goedgekeurd" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aanvraag goedgekeurd");
    void loadLog();
  }

  async function confirmReject() {
    if (!rejectFor) return;
    if (!rejectReason.trim()) {
      toast.error("Geef een reden op");
      return;
    }
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "afgekeurd", notes: rejectReason.trim() })
      .eq("id", rejectFor);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aanvraag afgekeurd");
    setRejectFor(null);
    setRejectReason("");
    void loadLog();
  }

  const statusVariant = (s: string) =>
    s === "goedgekeurd" ? "default" : s === "afgekeurd" ? "destructive" : "secondary";

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Derks" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Stucadoorsbedrijf Derks</h1>
              <p className="text-xs text-muted-foreground">Offertes & Facturen</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Welkom terug</h2>
          <p className="text-muted-foreground">Ingelogd als {user.email}</p>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Verlofaanvragen</h2>
            <Link to="/verlof" className="text-sm text-primary hover:underline">Alles bekijken</Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {logEntries.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Geen verlofaanvragen</div>
              ) : (
                <ul className="divide-y">
                  {logEntries.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{e.employee_name}</span>
                          <Badge variant="outline">{e.leave_type}</Badge>
                          <Badge variant={statusVariant(e.status) as any}>{e.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {e.start_date} t/m {e.end_date} · {Number(e.days).toFixed(1)} dagen
                          {e.reason ? ` · ${e.reason}` : ""}
                        </p>
                        {e.status === "afgekeurd" && e.notes && (
                          <p className="mt-1 text-xs text-destructive">Reden afkeuring: {e.notes}</p>
                        )}
                      </div>
                      {e.status === "aangevraagd" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approve(e.id)}>Akkoord</Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectFor(e.id); setRejectReason(""); }}>
                            Afkeuren
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Te factureren</h2>
            <Link to="/projecten" className="text-sm text-primary hover:underline">Alle projecten</Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {tefactureren.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Geen projecten te factureren</div>
              ) : (
                <ul className="divide-y">
                  {tefactureren.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-medium">{p.project_number}</span>
                          <Badge variant="secondary">te factureren</Badge>
                          {p.title && <span className="text-sm text-muted-foreground">· {p.title}</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {p.customer_name ?? "—"} · sinds {new Date(p.updated_at).toLocaleDateString("nl-NL")}
                        </p>
                      </div>
                      <Link to="/projecten/$id" params={{ id: p.id }}>
                        <Button size="sm" variant="outline">Open project</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => {
            const Icon = item.icon;
            const inner = (
              <Card
                className={
                  item.to
                    ? "cursor-pointer transition-colors hover:bg-accent/50"
                    : "cursor-not-allowed opacity-70"
                }
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  {!item.to && (
                    <p className="mt-2 text-xs italic text-muted-foreground">Binnenkort beschikbaar</p>
                  )}
                </CardContent>
              </Card>
            );
            return item.to ? (
              <Link key={item.title} to={item.to}>
                {inner}
              </Link>
            ) : (
              <div key={item.title}>{inner}</div>
            );
          })}
        </div>
      </main>

      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verlofaanvraag afkeuren</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Geef een reden op voor de afkeuring.</p>
            <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reden..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectReason(""); }}>Annuleren</Button>
            <Button variant="destructive" onClick={confirmReject}>Afkeuren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
