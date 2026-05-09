import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Save, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { sendTransactionalEmail } from "@/lib/email/send";
import { Checkbox } from "@/components/ui/checkbox";

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

  // Werkorder
  const [woWerkzaamheden, setWoWerkzaamheden] = useState("");
  const [woSignerName, setWoSignerName] = useState("");
  const [woSaving, setWoSaving] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  // Verzenden offerte
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendBcc, setSendBcc] = useState(true);
  const [sendDocId, setSendDocId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");
  const [contactName, setContactName] = useState("");

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

    // Load company settings + contact for verzendtab
    const { data: comp } = await supabase
      .from("company_settings")
      .select("company_name,email,quote_email_subject,quote_email_body")
      .eq("user_id", user!.id)
      .maybeSingle();
    setCompanyEmail(((comp as any)?.email as string) ?? "");

    let toEmail = "";
    let toName = "";
    let custName = "";
    if (p.contact_id) {
      const { data: ct } = await supabase
        .from("customer_contacts")
        .select("name,email")
        .eq("id", p.contact_id)
        .maybeSingle();
      toEmail = (ct?.email as string) ?? "";
      toName = (ct?.name as string) ?? "";
    }
    if (!toEmail && p.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("email,name,contact_person")
        .eq("id", p.customer_id)
        .maybeSingle();
      toEmail = (cust?.email as string) ?? "";
      toName = (cust?.contact_person as string) || (cust?.name as string) || "";
      custName = (cust?.name as string) || "";
    }
    if (!custName && p.customer_id) {
      const { data: cust2 } = await supabase
        .from("customers")
        .select("name")
        .eq("id", p.customer_id)
        .maybeSingle();
      custName = (cust2?.name as string) || "";
    }
    setSendTo(toEmail);
    setContactName(toName);

    const { data: q2 } = await supabase
      .from("quotes").select("quote_number").eq("project_id", id).maybeSingle();
    const qNum = (q2?.quote_number as string) ?? p.project_number;
    const cName = (comp as any)?.company_name ?? "";
    const subjTpl =
      ((comp as any)?.quote_email_subject as string) ??
      `Offerte {{quote_number}} - {{customer_name}}`;
    const bodyTpl = ((comp as any)?.quote_email_body as string) ?? "";
    const fill = (s: string) =>
      s
        .replaceAll("{{quote_number}}", qNum)
        .replaceAll("{{contact_name}}", toName || "klant")
        .replaceAll("{{customer_name}}", custName || toName || "klant")
        .replaceAll("{{company_name}}", cName);
    setSendSubject(fill(subjTpl));
    setSendBody(fill(bodyTpl));

    // Default selected doc = latest offerte pdf
    const latestOfferte = (d ?? []).find((x: any) => x.doc_type === "offerte");
    if (latestOfferte) setSendDocId((latestOfferte as any).id);
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

  const akkoordOrLater = ["akkoord", "in_uitvoering", "afgerond", "gefactureerd"].includes(
    project?.status ?? "",
  );

  const sendOfferte = async () => {
    if (!project || !user) return;
    if (!sendTo.trim()) return toast.error("Vul een e-mailadres van de ontvanger in");
    if (!sendDocId) return toast.error("Selecteer een offerte (pdf) om te versturen");
    const doc = docs.find((d) => d.id === sendDocId);
    if (!doc) return toast.error("Document niet gevonden");
    setSending(true);
    try {
      const { data: signed, error: sErr } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(doc.file_path, 60 * 60 * 24 * 30); // 30 dagen
      if (sErr || !signed) throw sErr ?? new Error("Geen downloadlink");
      const downloadUrl = signed.signedUrl;

      const { data: q2 } = await supabase
        .from("quotes").select("id,quote_number,valid_until,approval_token,approved_at").eq("project_id", project.id).maybeSingle();
      const quoteNumber = (q2?.quote_number as string) ?? project.project_number;
      const validUntil = q2?.valid_until
        ? new Date(q2.valid_until as string).toLocaleDateString("nl-NL")
        : undefined;

      // Zorg voor een approval-token (alleen als nog niet akkoord)
      let approvalUrl: string | undefined;
      if (q2?.id && !q2.approved_at) {
        let token = (q2 as any).approval_token as string | null;
        if (!token) {
          const bytes = new Uint8Array(24);
          crypto.getRandomValues(bytes);
          token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
          await supabase.from("quotes").update({ approval_token: token }).eq("id", q2.id);
        }
        // Gebruik de stabiele publieke URL van de gepubliceerde app, zodat de
        // klant de link zonder login kan openen. Preview-URL's vereisen login.
        const publicBase = "https://project--e4992d85-d4c7-4d9d-8b92-2b576b28432f.lovable.app";
        approvalUrl = `${publicBase}/offerte-akkoord/${token}`;
      }

      const { data: comp } = await supabase
        .from("company_settings").select("company_name").eq("user_id", user.id).maybeSingle();
      const companyName = (comp as any)?.company_name ?? "";

      const data = {
        contactName: contactName || "klant",
        quoteNumber,
        companyName,
        bodyText: sendBody,
        downloadUrl,
        validUntil,
        approvalUrl,
        subject: sendSubject,
      };

      await sendTransactionalEmail({
        templateName: "offerte-verzonden",
        recipientEmail: sendTo.trim(),
        idempotencyKey: `offerte-${project.id}-${doc.id}-${Date.now()}`,
        templateData: data,
      });

      if (sendBcc && companyEmail) {
        await sendTransactionalEmail({
          templateName: "offerte-verzonden",
          recipientEmail: companyEmail,
          idempotencyKey: `offerte-bcc-${project.id}-${doc.id}-${Date.now()}`,
          templateData: { ...data, subject: `[Kopie] ${sendSubject}` },
        });
      }

      if (project.status === "nieuw") {
        await supabase.from("projects").update({ status: "offerte" }).eq("id", project.id);
      }
      toast.success("Offerte verzonden");
      load();
    } catch (e: any) {
      toast.error("Versturen mislukt: " + (e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  const markeerAkkoord = async () => {
    if (!project || !quote) return;
    if (!confirm("Offerte handmatig op 'Akkoord' zetten?")) return;
    const now = new Date().toISOString();
    const { error: qe } = await supabase
      .from("quotes")
      .update({ status: "akkoord", approved_at: now })
      .eq("id", quote.id);
    if (qe) return toast.error("Bijwerken mislukt: " + qe.message);
    await supabase.from("projects").update({ status: "akkoord" }).eq("id", project.id);
    toast.success("Offerte gemarkeerd als akkoord");
    load();
  };

  const generateWerkorderPdf = async () => {
    if (!project || !user) return;
    if (!akkoordOrLater) {
      toast.error("Werkorder kan pas vanaf status 'Akkoord' worden gegenereerd");
      return;
    }
    if (!woWerkzaamheden.trim()) {
      toast.error("Vul de uitgevoerde werkzaamheden in");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Laat de klant ondertekenen");
      return;
    }
    if (!woSignerName.trim()) {
      toast.error("Vul de naam van de ondertekenaar in");
      return;
    }
    setWoSaving(true);
    try {
      const sigData = sigRef.current.toDataURL();
      const [{ data: company }, { data: cust }] = await Promise.all([
        supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
        project.customer_id
          ? supabase.from("customers").select("*").eq("id", project.customer_id).maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      let y = 15;

      // Logo
      const logoTop = y;
      const logoH = 28;
      if (company?.logo_url) {
        try {
          const resp = await fetch(company.logo_url);
          const blob = await resp.blob();
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
          const imgFmt = (blob.type.includes("png") ? "PNG" : "JPEG") as "PNG" | "JPEG";
          doc.addImage(dataUrl, imgFmt, 15, logoTop, 50, logoH, undefined, "FAST");
        } catch {}
      }

      // Bedrijfsgegevens rechts
      const rightX = W - 15;
      doc.setFontSize(13).setFont("helvetica", "bold");
      doc.text(company?.company_name ?? "Bedrijf", rightX, y + 4, { align: "right" });
      doc.setFontSize(9).setFont("helvetica", "normal");
      const addrLines = [
        company?.address,
        [company?.postal_code, company?.city].filter(Boolean).join(" "),
      ].filter(Boolean) as string[];
      addrLines.forEach((line, i) => doc.text(line, rightX, y + 9 + i * 4, { align: "right" }));
      const labeled: { label: string; value?: string | null }[] = [
        { label: "E-Mail", value: company?.email },
        { label: "KvK-nummer", value: company?.kvk_number },
        { label: "BTW-nummer", value: company?.vat_number },
        { label: "Telefoon", value: company?.phone },
      ];
      let ly = y + 9 + addrLines.length * 4 + 2;
      for (const row of labeled) {
        if (!row.value) continue;
        doc.text(`${row.label}: ${row.value}`, rightX, ly, { align: "right" });
        ly += 4;
      }
      y = Math.max(logoTop + logoH, ly) + 6;

      // Klant
      doc.setFontSize(10).setFont("helvetica", "bold");
      doc.text("Aan:", 15, y);
      doc.setFont("helvetica", "normal").setFontSize(9);
      const custLines = [
        cust?.name,
        [cust?.street, cust?.house_number, cust?.house_number_addition].filter(Boolean).join(" ") || cust?.address,
        [cust?.postal_code, cust?.city].filter(Boolean).join(" "),
        cust?.country,
      ].filter(Boolean) as string[];
      custLines.forEach((line, i) => doc.text(line, 15, y + 5 + i * 4));
      y += 5 + custLines.length * 4 + 8;

      // Titel
      doc.setFontSize(14).setFont("helvetica", "bold");
      doc.text(`Werkorder ${project.project_number}`, 15, y);
      doc.setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Datum: ${new Date().toLocaleDateString("nl-NL")}`, W - 15, y, { align: "right" });
      if (project.title) doc.text(project.title, 15, y + 5);
      y += 10;
      doc.setDrawColor(10, 36, 99);
      doc.setLineWidth(0.5);
      doc.line(15, y, W - 15, y);
      doc.setDrawColor(0);
      y += 6;

      // Werkzaamheden
      doc.setFontSize(11).setFont("helvetica", "bold");
      doc.text("Uitgevoerde werkzaamheden", 15, y);
      y += 6;
      doc.setFontSize(10).setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(woWerkzaamheden, W - 30);
      doc.text(wrapped, 15, y);
      y += wrapped.length * 5 + 10;

      // Ondertekening
      doc.setFontSize(11).setFont("helvetica", "bold");
      doc.text("Akkoord klant na uitvoering", 15, y);
      y += 6;
      doc.setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Naam: ${woSignerName}`, 15, y);
      doc.text(`Datum: ${new Date().toLocaleDateString("nl-NL")}`, 15, y + 5);
      try {
        doc.addImage(sigData, "PNG", 90, y - 4, 80, 30, undefined, "FAST");
      } catch {}
      doc.setDrawColor(150);
      doc.line(90, y + 28, 170, y + 28);
      doc.setFontSize(8).setTextColor(100);
      doc.text("Handtekening", 90, y + 32);
      doc.setTextColor(0);

      // Footer
      const footerY = 280;
      if ((company as any)?.footer_image_url) {
        try {
          const resp = await fetch((company as any).footer_image_url);
          const blob = await resp.blob();
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
          const fmtImg = (blob.type.includes("png") ? "PNG" : "JPEG") as "PNG" | "JPEG";
          doc.addImage(dataUrl, fmtImg, 15, footerY - 12, 30, 12, undefined, "FAST");
        } catch {}
      }
      const footerText = (company as any)?.footer_text || (company as any)?.quote_footer;
      if (footerText) {
        const footer = doc.splitTextToSize(footerText, W - 60);
        doc.setFontSize(8).setTextColor(100);
        doc.text(footer, W - 15, footerY - 6, { align: "right" });
        doc.setTextColor(0);
      }

      const blob = doc.output("blob");
      const { data: existing } = await supabase
        .from("project_documents")
        .select("version")
        .eq("project_id", project.id)
        .eq("doc_type", "werkorder")
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = ((existing?.[0]?.version as number) ?? 0) + 1;
      const path = `${user.id}/${project.id}/werkorder-v${nextVersion}-${project.project_number}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      await supabase.from("project_documents").insert({
        user_id: user.id,
        project_id: project.id,
        doc_type: "werkorder",
        file_name: `Werkorder-${project.project_number}-v${nextVersion}.pdf`,
        file_path: path,
        version: nextVersion,
        mime_type: "application/pdf",
        file_size: blob.size,
      });
      await supabase.from("work_orders").insert({
        user_id: user.id,
        project_id: project.id,
        work_date: new Date().toISOString().slice(0, 10),
        executor: woSignerName,
        notes: woWerkzaamheden,
        status: "uitgevoerd",
      });
      await supabase.from("projects").update({ status: "afgerond" }).eq("id", project.id);

      doc.save(`Werkorder-${project.project_number}.pdf`);
      toast.success(`Werkorder opgeslagen (v${nextVersion}). Project op 'Afgerond'.`);
      setWoWerkzaamheden("");
      setWoSignerName("");
      sigRef.current?.clear();
      load();
    } catch (e: any) {
      toast.error("Werkorder mislukt: " + (e?.message ?? e));
    } finally {
      setWoSaving(false);
    }
  };

  if (authLoading || !user || !project) return null;

  return (
    <AppShell title={`Project ${project.project_number}`} subtitle={project.title || "Projectdossier"} back>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="quote">Offerte</TabsTrigger>
          <TabsTrigger value="verzenden">Verzenden</TabsTrigger>
          <TabsTrigger value="werkorder">Werkorder</TabsTrigger>
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
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-lg">{quote.quote_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: <Badge variant="secondary">{quote.status}</Badge> ·
                      Totaal: <span className="font-medium">{fmt(Number(quote.total))}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quote.status !== "akkoord" && (
                      <Button variant="outline" onClick={markeerAkkoord}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Markeer als akkoord
                      </Button>
                    )}
                    <Button onClick={() => navigate({ to: "/offertes/$id", params: { id: quote.id } })}>
                      <Pencil className="mr-1 h-4 w-4" /> Offerte bewerken
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen offerte gekoppeld.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verzenden">
          <Card>
            <CardHeader><CardTitle className="text-base">Offerte verzenden</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {docs.filter((d) => d.doc_type === "offerte").length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Er is nog geen offerte-pdf in het dossier. Genereer eerst een definitieve offerte.
                </p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Bijlage (offerte-pdf)</Label>
                    <Select value={sendDocId} onValueChange={setSendDocId}>
                      <SelectTrigger><SelectValue placeholder="Kies offerte-pdf" /></SelectTrigger>
                      <SelectContent>
                        {docs
                          .filter((d) => d.doc_type === "offerte")
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.file_name} (v{d.version})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standaard: laatste versie. De ontvanger krijgt een downloadlink (30 dagen geldig).
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Aan (e-mailadres)</Label>
                      <Input
                        type="email"
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        placeholder="klant@voorbeeld.nl"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Naam ontvanger</Label>
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Naam contactpersoon"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Onderwerp</Label>
                    <Input value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Mailtekst</Label>
                    <Textarea
                      rows={8}
                      value={sendBody}
                      onChange={(e) => setSendBody(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standaardtekst komt uit Bedrijfsgegevens. Placeholders: <code>{"{{quote_number}}"}</code>, <code>{"{{contact_name}}"}</code>, <code>{"{{company_name}}"}</code>.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={sendBcc}
                      onCheckedChange={(v) => setSendBcc(Boolean(v))}
                    />
                    Stuur kopie naar mijzelf{companyEmail ? ` (${companyEmail})` : ""}
                  </label>
                  <div className="flex justify-end">
                    <Button onClick={sendOfferte} disabled={sending}>
                      {sending ? "Verzenden..." : "Offerte verzenden"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="werkorder">
          <Card>
            <CardHeader><CardTitle className="text-base">Werkorder</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!akkoordOrLater ? (
                <p className="text-sm text-muted-foreground">
                  Werkorder kan worden aangemaakt zodra de project­status op <strong>Akkoord</strong> staat.
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Project- / offertenummer</Label>
                      <Input value={project.project_number} readOnly className="font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs">Datum</Label>
                      <Input value={new Date().toLocaleDateString("nl-NL")} readOnly />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Uitgevoerde werkzaamheden</Label>
                    <Textarea
                      rows={6}
                      value={woWerkzaamheden}
                      onChange={(e) => setWoWerkzaamheden(e.target.value)}
                      placeholder="Beschrijf wat er is uitgevoerd..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Naam ondertekenaar (klant)</Label>
                    <Input
                      value={woSignerName}
                      onChange={(e) => setWoSignerName(e.target.value)}
                      placeholder="Naam klant"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Handtekening klant</Label>
                    <SignaturePad ref={sigRef} />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={generateWerkorderPdf} disabled={woSaving}>
                      <Save className="mr-1 h-4 w-4" />
                      {woSaving ? "Opslaan..." : "Werkorder opslaan & afronden"}
                    </Button>
                  </div>
                </>
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