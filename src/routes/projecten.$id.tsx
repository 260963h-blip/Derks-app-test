import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Save, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projecten/$id")({
  component: ProjectDossier,
});

type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  customer_id: string | null;
  contact_id: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};
type Customer = { id: string; name: string; customer_type: string };
type Quote = { id: string; quote_number: string; status: string; total: number };
type Doc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  version: number;
  created_at: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

function ProjectDossier() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const load = async () => {
    const { data: p, error } = await supabase
      .from("projects").select("*").eq("id", id).maybeSingle();
    if (error || !p) {
      toast.error("Project niet gevonden");
      navigate({ to: "/projecten" });
      return;
    }
    setProject(p as Project);
    const { data: cs } = await supabase
      .from("customers").select("id,name,customer_type").order("name");
    setCustomers((cs ?? []) as Customer[]);
    if (p.customer_id) {
      const c = (cs ?? []).find((x: any) => x.id === p.customer_id) ?? null;
      setCustomer(c as Customer | null);
    }
    const { data: q } = await supabase
      .from("quotes").select("id,quote_number,status,total")
      .eq("project_id", id).maybeSingle();
    setQuote((q ?? null) as Quote | null);
    const { data: d } = await supabase
      .from("project_documents")
      .select("id,doc_type,file_name,file_path,version,created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    setDocs((d ?? []) as Doc[]);
  };

  const saveProject = async () => {
    if (!project) return;
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        title: project.title,
        status: project.status,
        customer_id: project.customer_id,
        reference: project.reference,
        notes: project.notes,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) return toast.error("Opslaan mislukt: " + error.message);
    toast.success("Project opgeslagen");
    load();
  };

  const downloadDoc = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(d.file_path, 60);
    if (error || !data) return toast.error("Downloaden mislukt");
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (d: Doc) => {
    if (!confirm(`Document "${d.file_name}" verwijderen?`)) return;
    await supabase.storage.from("project-documents").remove([d.file_path]);
    await supabase.from("project_documents").delete().eq("id", d.id);
    load();
  };

  if (authLoading || !user || !project) return null;

  return (
    <AppShell title={`Project ${project.project_number}`} subtitle={project.title || "Projectdossier"} back>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="quote">Offerte</TabsTrigger>
          <TabsTrigger value="documents">Documenten ({docs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle className="text-base">Projectgegevens</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Projectnummer</Label>
                <Input value={project.project_number} readOnly className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={project.status} onValueChange={(v) => setProject({ ...project, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nieuw">Nieuw</SelectItem>
                    <SelectItem value="offerte">Offerte verzonden</SelectItem>
                    <SelectItem value="akkoord">Akkoord</SelectItem>
                    <SelectItem value="in_uitvoering">In uitvoering</SelectItem>
                    <SelectItem value="afgerond">Afgerond</SelectItem>
                    <SelectItem value="gefactureerd">Gefactureerd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Titel</Label>
                <Input value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Klant</Label>
                <Select
                  value={project.customer_id ?? undefined}
                  onValueChange={(v) => {
                    setProject({ ...project, customer_id: v });
                    setCustomer(customers.find((c) => c.id === v) ?? null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecteer klant..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.customer_type === "zakelijk" ? "· zakelijk" : "· particulier"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Referentie</Label>
                <Input
                  value={project.reference ?? ""}
                  onChange={(e) => setProject({ ...project, reference: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Notities</Label>
                <Input
                  value={project.notes ?? ""}
                  onChange={(e) => setProject({ ...project, notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveProject} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> {saving ? "Opslaan..." : "Project opslaan"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="quote">
          <Card>
            <CardHeader><CardTitle className="text-base">Offerte</CardTitle></CardHeader>
            <CardContent>
              {quote ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-lg">{quote.quote_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: <Badge variant="secondary">{quote.status}</Badge> ·
                      Totaal: <span className="font-medium">{fmt(Number(quote.total))}</span>
                    </p>
                  </div>
                  <Button onClick={() => navigate({ to: "/offertes/$id", params: { id: quote.id } })}>
                    <Pencil className="mr-1 h-4 w-4" /> Offerte bewerken
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen offerte gekoppeld.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle className="text-base">Documenten</CardTitle></CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen documenten. Genereer een offerte definitief om de pdf hier te bewaren.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Bestand</TableHead>
                      <TableHead>Versie</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-[140px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                        <TableCell className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />{d.file_name}
                        </TableCell>
                        <TableCell>v{d.version}</TableCell>
                        <TableCell>{new Date(d.created_at).toLocaleString("nl-NL")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => downloadDoc(d)} title="Downloaden">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteDoc(d)} title="Verwijderen">
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
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}