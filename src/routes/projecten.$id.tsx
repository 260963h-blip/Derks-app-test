import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { FileText, Download, Save, Pencil, Trash2, CheckCircle2, Upload, Sparkles, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { sendTransactionalEmail } from "@/lib/email/send";
import { Checkbox } from "@/components/ui/checkbox";
import { generateInvoiceText } from "@/lib/invoice-text.functions";
import { buildUblInvoiceXml } from "@/lib/invoice-ubl";

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
type QuoteLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  sort_order: number;
};
type QuoteFull = {
  id: string;
  quote_number: string;
  status: string;
  total: number;
  subtotal: number;
  vat_total: number;
  vat_mode: string;
  reference: string | null;
};
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  vat_total: number;
  total: number;
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
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Werkorder
  const [woSignerName, setWoSignerName] = useState("");
  const [woDate, setWoDate] = useState(new Date().toISOString().slice(0, 10));
  const [woSaving, setWoSaving] = useState(false);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "overview";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t || "overview";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (activeTab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  // Verzenden offerte
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendBcc, setSendBcc] = useState(true);
  const [sendDocId, setSendDocId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");
  const [contactName, setContactName] = useState("");

  // Factureren
  const genInvoiceText = useServerFn(generateInvoiceText);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceText, setInvoiceText] = useState("");
  const [genInvText, setGenInvText] = useState(false);
  const [genInvPdf, setGenInvPdf] = useState(false);
  const [invSendTo, setInvSendTo] = useState("");
  const [invSendCc, setInvSendCc] = useState("");
  const [invSendSubject, setInvSendSubject] = useState("");
  const [invSendBody, setInvSendBody] = useState("");
  const [invAttachIds, setInvAttachIds] = useState<Record<string, boolean>>({});
  const [invSending, setInvSending] = useState(false);

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
    if (q?.id) {
      const { data: lines } = await supabase
        .from("quote_lines")
        .select("id,description,quantity,unit,sort_order")
        .eq("quote_id", q.id)
        .order("sort_order");
      setQuoteLines((lines ?? []) as QuoteLine[]);
    } else {
      setQuoteLines([]);
    }
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

    // Factureren: load latest invoice for this project
    const { data: inv } = await supabase
      .from("invoices")
      .select("id,invoice_number,invoice_date,due_date,status,subtotal,vat_total,total")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setInvoice((inv ?? null) as Invoice | null);

    // Factuurmail defaults
    let invTo = "";
    let invCc = "";
    if (p.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("email,email_invoice,customer_type")
        .eq("id", p.customer_id)
        .maybeSingle();
      if (cust?.customer_type === "zakelijk") {
        invTo = (cust?.email_invoice as string) || (cust?.email as string) || "";
        if (cust?.email_invoice && cust?.email && cust.email !== cust.email_invoice) {
          invCc = cust.email as string;
        }
      } else {
        invTo = (cust?.email as string) || "";
      }
    }
    if (!invTo && p.contact_id) {
      const { data: ct } = await supabase
        .from("customer_contacts").select("email").eq("id", p.contact_id).maybeSingle();
      invTo = (ct?.email as string) ?? "";
    }
    setInvSendTo(invTo);
    setInvSendCc(invCc);
    const invNum = (inv?.invoice_number as string) ?? "";
    setInvSendSubject(invNum ? `Factuur ${invNum} - ${(comp as any)?.company_name ?? ""}` : "");
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

  const uploadDoc = async () => {
    if (!project || !user) return;
    if (!uploadFile) return toast.error("Kies een bestand");
    if (!uploadName.trim()) return toast.error("Geef een naam op");
    setUploading(true);
    try {
      const ext = uploadFile.name.includes(".") ? uploadFile.name.split(".").pop() : "";
      const safe = uploadName.trim().replace(/[^a-zA-Z0-9-_ ]/g, "_");
      const fileName = ext ? `${safe}.${ext}` : safe;
      const path = `${user.id}/${project.id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, uploadFile, { contentType: uploadFile.type || undefined });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("project_documents").insert({
        user_id: user.id,
        project_id: project.id,
        doc_type: uploadName.trim(),
        file_name: fileName,
        file_path: path,
        file_size: uploadFile.size,
        mime_type: uploadFile.type || null,
        version: 1,
      });
      if (insErr) throw insErr;
      toast.success("Document geüpload");
      setUploadFile(null);
      setUploadName("");
      const fileInput = document.getElementById("doc-upload-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      load();
    } catch (e: any) {
      toast.error("Upload mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setUploading(false);
    }
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
        .from("quotes").select("quote_number,valid_until").eq("project_id", project.id).maybeSingle();
      const quoteNumber = (q2?.quote_number as string) ?? project.project_number;
      const validUntil = q2?.valid_until
        ? new Date(q2.valid_until as string).toLocaleDateString("nl-NL")
        : undefined;

      // Genereer/hergebruik approval_token zodat de klant via een knop in de mail akkoord kan geven
      let approvalUrl: string | undefined;
      if (quote?.id) {
        let token: string | null = (quote as any).approval_token ?? null;
        if (!token) {
          token = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
          await supabase.from("quotes").update({ approval_token: token }).eq("id", quote.id);
        }
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        approvalUrl = `${origin}/offerte/akkoord?token=${encodeURIComponent(token)}`;
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
    if (quoteLines.length === 0) {
      toast.error("Geen offerteregels gevonden om over te nemen");
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

      // Offertetekst (zonder bedragen)
      doc.setFontSize(11).setFont("helvetica", "bold");
      doc.text("Omschrijving werkzaamheden (conform offerte)", 15, y);
      y += 6;
      doc.setFontSize(10).setFont("helvetica", "normal");
      for (const line of quoteLines) {
        const qty = Number(line.quantity || 0);
        const prefix = qty && qty !== 1 ? `${qty}${line.unit ? " " + line.unit : ""} - ` : "";
        const text = `${prefix}${line.description || ""}`.trim();
        const wrapped = doc.splitTextToSize(text, W - 30);
        if (y + wrapped.length * 5 > 250) { doc.addPage(); y = 20; }
        doc.text(wrapped, 15, y);
        y += wrapped.length * 5 + 2;
      }
      y += 6;
      doc.setFont("helvetica", "italic");
      const conform = doc.splitTextToSize(
        "Werkzaamheden conform offerte uitgevoerd.", W - 30,
      );
      doc.text(conform, 15, y);
      doc.setFont("helvetica", "normal");
      y += conform.length * 5 + 8;
      if (y > 230) { doc.addPage(); y = 20; }

      // Ondertekening
      doc.setFontSize(11).setFont("helvetica", "bold");
      doc.text("Akkoord klant na uitvoering", 15, y);
      y += 6;
      doc.setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Naam: ${woSignerName}`, 15, y);
      doc.text(
        `Datum: ${new Date(woDate).toLocaleDateString("nl-NL")}`,
        15,
        y + 5,
      );
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
        work_date: woDate,
        executor: woSignerName,
        notes: "Werkzaamheden conform offerte uitgevoerd.",
        status: "uitgevoerd",
      });
      await supabase
        .from("projects")
        .update({ status: "te_factureren" })
        .eq("id", project.id);

      doc.save(`Werkorder-${project.project_number}.pdf`);
      toast.success(`Werkorder opgeslagen (v${nextVersion}). Project op 'Te factureren'.`);
      setWoSignerName("");
      sigRef.current?.clear();
      load();
    } catch (e: any) {
      toast.error("Werkorder mislukt: " + (e?.message ?? e));
    } finally {
      setWoSaving(false);
    }
  };

  const generateInvText = async () => {
    if (!project || !user) return;
    setGenInvText(true);
    try {
      const { data: cust } = project.customer_id
        ? await supabase.from("customers").select("name,customer_type").eq("id", project.customer_id).maybeSingle()
        : ({ data: null } as any);
      const { data: q } = await supabase
        .from("quotes").select("quote_number").eq("project_id", project.id).maybeSingle();
      const { data: comp } = await supabase
        .from("company_settings")
        .select("company_name,owner_first_name,owner_middle_name,owner_last_name")
        .eq("user_id", user.id).maybeSingle();
      const ownerName = [(comp as any)?.owner_first_name, (comp as any)?.owner_middle_name, (comp as any)?.owner_last_name]
        .filter(Boolean).join(" ").trim();
      const { data: wos } = await supabase
        .from("work_orders").select("work_date").eq("project_id", project.id).order("work_date", { ascending: true });
      const dates = (wos ?? [])
        .map((w: any) => w.work_date)
        .filter(Boolean)
        .map((d: string) => new Date(d).toLocaleDateString("nl-NL"));
      const { text } = await genInvoiceText({
        data: {
          customer_name: (cust as any)?.name ?? "klant",
          customer_type: (cust as any)?.customer_type ?? "particulier",
          quote_number: (q as any)?.quote_number ?? null,
          project_title: project.title || null,
          execution_dates: dates,
          lines: quoteLines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity || 0),
            unit: l.unit,
          })),
          company_name: (comp as any)?.company_name ?? null,
          owner_name: ownerName || null,
        },
      });
      setInvoiceText(text);
      toast.success("Factuurtekst gegenereerd");
    } catch (e: any) {
      toast.error("Genereren mislukt: " + (e?.message ?? e));
    } finally {
      setGenInvText(false);
    }
  };

  const generateInvoicePdf = async () => {
    if (!project || !user) return;
    if (!invoiceText.trim()) return toast.error("Genereer of typ eerst de factuurtekst");
    setGenInvPdf(true);
    try {
      // 1) Bepaal volgend factuurnummer
      const { data: comp } = await supabase
        .from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (!comp) throw new Error("Bedrijfsgegevens ontbreken");
      const year = new Date().getFullYear();
      const sameYear = (comp as any).invoice_number_year === year;
      const nextNum = sameYear ? ((comp as any).invoice_number_next ?? 1) : 1;
      const prefix = (comp as any).invoice_number_prefix ?? "F";
      const invoiceNumber = `${prefix}${year}-${String(nextNum).padStart(4, "0")}`;

      // 2) Quote / regels / klant ophalen
      const { data: q } = await supabase
        .from("quotes")
        .select("id,quote_number,subtotal,vat_total,total,vat_mode,reference")
        .eq("project_id", project.id).maybeSingle();
      const { data: cust } = project.customer_id
        ? await supabase.from("customers").select("*").eq("id", project.customer_id).maybeSingle()
        : ({ data: null } as any);
      const { data: contactRes } = project.contact_id
        ? await supabase.from("customer_contacts").select("*").eq("id", project.contact_id).maybeSingle()
        : ({ data: null } as any);
      let lines: any[] = [];
      if (q?.id) {
        const { data: ll } = await supabase
          .from("quote_lines")
          .select("description,quantity,unit,unit_price,vat_rate,line_total,sort_order")
          .eq("quote_id", q.id).order("sort_order");
        lines = ll ?? [];
      }
      const subtotal = Number((q as any)?.subtotal ?? 0);
      const vatTotal = Number((q as any)?.vat_total ?? 0);
      const total = Number((q as any)?.total ?? 0);
      const vatMode = (q as any)?.vat_mode ?? "hoog";
      const dueDays = (comp as any).default_payment_term_days ?? 14;
      const today = new Date();
      const due = new Date(today.getTime() + dueDays * 86400000);
      const invoiceDate = today.toISOString().slice(0, 10);
      const dueDate = due.toISOString().slice(0, 10);

      // 3) PDF bouwen
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      let y = 15;

      const logoTop = y;
      const logoH = 28;
      if ((comp as any)?.logo_url) {
        try {
          const resp = await fetch((comp as any).logo_url);
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

      const rightX = W - 15;
      doc.setFontSize(13).setFont("helvetica", "bold");
      doc.text((comp as any)?.company_name ?? "Bedrijf", rightX, y + 4, { align: "right" });
      doc.setFontSize(9).setFont("helvetica", "normal");
      const addrLines = [
        (comp as any)?.address,
        [(comp as any)?.postal_code, (comp as any)?.city].filter(Boolean).join(" "),
      ].filter(Boolean) as string[];
      addrLines.forEach((line, i) => doc.text(line, rightX, y + 9 + i * 4, { align: "right" }));
      const labeled: { label: string; value?: string | null }[] = [
        { label: "E-Mail", value: (comp as any)?.email },
        { label: "KvK-nummer", value: (comp as any)?.kvk_number },
        { label: "BTW-nummer", value: (comp as any)?.vat_number },
        { label: "Telefoon", value: (comp as any)?.phone },
        { label: "IBAN", value: (comp as any)?.iban },
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
        (cust as any)?.name,
        contactRes?.name ? `T.a.v. ${contactRes.name}` : null,
        [(cust as any)?.street, (cust as any)?.house_number, (cust as any)?.house_number_addition].filter(Boolean).join(" ") || (cust as any)?.address,
        [(cust as any)?.postal_code, (cust as any)?.city].filter(Boolean).join(" "),
        (cust as any)?.country,
        (cust as any)?.customer_type === "zakelijk" && (cust as any)?.vat_number ? `BTW: ${(cust as any).vat_number}` : null,
        (cust as any)?.customer_type === "zakelijk" && (cust as any)?.kvk_number ? `KvK: ${(cust as any).kvk_number}` : null,
      ].filter(Boolean) as string[];
      custLines.forEach((line, i) => doc.text(line, 15, y + 5 + i * 4));
      y += 5 + custLines.length * 4 + 8;

      // Titel + meta
      doc.setFontSize(14).setFont("helvetica", "bold");
      doc.text(`Factuur ${invoiceNumber}`, 15, y);
      doc.setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Factuurdatum: ${new Date(invoiceDate).toLocaleDateString("nl-NL")}`, W - 15, y, { align: "right" });
      doc.text(`Vervaldatum: ${new Date(dueDate).toLocaleDateString("nl-NL")}`, W - 15, y + 5, { align: "right" });
      if (q?.quote_number) doc.text(`Offerte: ${q.quote_number}`, 15, y + 5);
      y += 10;
      doc.setDrawColor(10, 36, 99); doc.setLineWidth(0.5);
      doc.line(15, y, W - 15, y);
      doc.setDrawColor(0);
      y += 5;

      // Tekst
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(invoiceText, W - 30);
      if (y + wrapped.length * 5 > 250) { doc.addPage(); y = 20; }
      doc.text(wrapped, 15, y, { maxWidth: W - 30 });
      y += wrapped.length * 5 + 6;

      // Regels (compact)
      if (lines.length > 0) {
        if (y + 20 > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold").setFontSize(10);
        doc.text("Omschrijving", 15, y);
        doc.text("Aantal", 120, y, { align: "right" });
        doc.text("Prijs", 150, y, { align: "right" });
        doc.text("Totaal", W - 15, y, { align: "right" });
        y += 2;
        doc.setLineWidth(0.2); doc.line(15, y, W - 15, y);
        y += 4;
        doc.setFont("helvetica", "normal").setFontSize(9);
        for (const l of lines) {
          const desc = doc.splitTextToSize(String(l.description ?? ""), 100);
          if (y + desc.length * 4 > 260) { doc.addPage(); y = 20; }
          doc.text(desc, 15, y);
          const qty = `${Number(l.quantity || 0)}${l.unit ? " " + l.unit : ""}`;
          doc.text(qty, 120, y, { align: "right" });
          doc.text(fmt(Number(l.unit_price || 0)), 150, y, { align: "right" });
          doc.text(fmt(Number(l.line_total || 0)), W - 15, y, { align: "right" });
          y += Math.max(4, desc.length * 4) + 2;
        }
        y += 2;
      }

      // Totalen
      if (y + 25 > 270) { doc.addPage(); y = 20; }
      const xLabel = W - 80;
      const xVal = W - 15;
      doc.setFontSize(10);
      doc.text("Subtotaal", xLabel, y);
      doc.text(fmt(subtotal), xVal, y, { align: "right" });
      y += 5;
      if (vatMode === "verlegd") {
        doc.text("BTW verlegd", xLabel, y);
        doc.text("—", xVal, y, { align: "right" });
      } else {
        doc.text("BTW", xLabel, y);
        doc.text(fmt(vatTotal), xVal, y, { align: "right" });
      }
      y += 3;
      doc.setLineWidth(0.3); doc.line(xLabel, y, xVal, y);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Totaal te voldoen", xLabel, y);
      doc.text(fmt(total), xVal, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.setFontSize(9);
      doc.text(
        `Wij verzoeken u het bedrag van ${fmt(total)} binnen ${dueDays} dagen over te maken op IBAN ${(comp as any)?.iban ?? ""} o.v.v. ${invoiceNumber}.`,
        15, y, { maxWidth: W - 30 } as any,
      );

      // Footer
      const footerY = 280;
      const footerText = (comp as any)?.footer_text || (comp as any)?.invoice_footer || (comp as any)?.quote_footer;
      if (footerText) {
        const footer = doc.splitTextToSize(footerText, W - 60);
        doc.setFontSize(8).setTextColor(100);
        doc.text(footer, W - 15, footerY - 6, { align: "right" });
        doc.setTextColor(0);
      }

      // 4) Opslaan: invoice record + storage + project_documents
      const blob = doc.output("blob");
      const path = `${user.id}/${project.id}/factuur-${invoiceNumber}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { data: invIns, error: invErr } = await supabase.from("invoices").insert({
        user_id: user.id,
        project_id: project.id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: "verzonden",
        subtotal,
        vat_total: vatTotal,
        total,
        notes: invoiceText,
      }).select("id,invoice_number,invoice_date,due_date,status,subtotal,vat_total,total").maybeSingle();
      if (invErr) throw invErr;

      await supabase.from("project_documents").insert({
        user_id: user.id,
        project_id: project.id,
        doc_type: "factuur",
        file_name: `Factuur-${invoiceNumber}.pdf`,
        file_path: path,
        version: 1,
        mime_type: "application/pdf",
        file_size: blob.size,
      });

      // 4b) UBL e-factuur (XML) genereren en opslaan naast de pdf
      try {
        const xml = buildUblInvoiceXml({
          invoiceNumber,
          invoiceDate,
          dueDate,
          subtotal,
          vatTotal,
          total,
          vatMode,
          notes: invoiceText,
          quoteNumber: q?.quote_number ?? null,
          projectNumber: project.project_number,
          company: comp as any,
          customer: cust as any,
          contact: contactRes as any,
          lines,
        });
        const xmlBlob = new Blob([xml], { type: "application/xml" });
        const xmlPath = `${user.id}/${project.id}/factuur-${invoiceNumber}.xml`;
        const { error: xmlUpErr } = await supabase.storage
          .from("project-documents")
          .upload(xmlPath, xmlBlob, { contentType: "application/xml", upsert: false });
        if (xmlUpErr) throw xmlUpErr;
        await supabase.from("project_documents").insert({
          user_id: user.id,
          project_id: project.id,
          doc_type: "factuur",
          file_name: `Factuur-${invoiceNumber}.xml`,
          file_path: xmlPath,
          version: 1,
          mime_type: "application/xml",
          file_size: xmlBlob.size,
        });
      } catch (xmlErr: any) {
        console.error("UBL XML genereren mislukt", xmlErr);
        toast.warning("Factuur-pdf opgeslagen, maar XML genereren mislukte: " + (xmlErr?.message ?? xmlErr));
      }

      // Bump nummer in instellingen
      await supabase.from("company_settings").update({
        invoice_number_year: year,
        invoice_number_next: nextNum + 1,
      }).eq("user_id", user.id);

      // Project op gefactureerd
      await supabase.from("projects").update({ status: "gefactureerd" }).eq("id", project.id);

      doc.save(`Factuur-${invoiceNumber}.pdf`);
      toast.success(`Factuur ${invoiceNumber} aangemaakt`);
      setInvoice(invIns as Invoice);
      setInvSendSubject(`Factuur ${invoiceNumber} - ${(comp as any)?.company_name ?? ""}`);
      load();
    } catch (e: any) {
      toast.error("Factuur mislukt: " + (e?.message ?? e));
    } finally {
      setGenInvPdf(false);
    }
  };

  const sendFactuur = async () => {
    if (!project || !user || !invoice) return;
    if (!invSendTo.trim()) return toast.error("Vul een e-mailadres in");
    setInvSending(true);
    try {
      // Vind factuur-pdf
      const factuurDoc = docs.find((d) => d.doc_type === "factuur" && d.file_name.endsWith(".pdf") && d.file_name.includes(invoice.invoice_number))
        ?? docs.find((d) => d.doc_type === "factuur" && d.file_name.endsWith(".pdf"));
      if (!factuurDoc) throw new Error("Factuur-pdf niet gevonden");
      const { data: signed } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(factuurDoc.file_path, 60 * 60 * 24 * 30);
      const downloadUrl = signed?.signedUrl ?? "#";

      // Bijlagen
      const attachments: { name: string; url: string }[] = [];
      // Standaard altijd de UBL XML e-factuur meesturen
      const xmlDoc = docs.find((d) => d.doc_type === "factuur" && d.file_name.endsWith(".xml") && d.file_name.includes(invoice.invoice_number))
        ?? docs.find((d) => d.doc_type === "factuur" && d.file_name.endsWith(".xml"));
      if (xmlDoc) {
        const { data: sx } = await supabase.storage
          .from("project-documents")
          .createSignedUrl(xmlDoc.file_path, 60 * 60 * 24 * 30);
        if (sx?.signedUrl) attachments.push({ name: xmlDoc.file_name, url: sx.signedUrl });
      }
      for (const did of Object.keys(invAttachIds).filter((k) => invAttachIds[k])) {
        const d = docs.find((x) => x.id === did);
        if (!d || d.id === factuurDoc.id || (xmlDoc && d.id === xmlDoc.id)) continue;
        const { data: s } = await supabase.storage
          .from("project-documents")
          .createSignedUrl(d.file_path, 60 * 60 * 24 * 30);
        if (s?.signedUrl) attachments.push({ name: d.file_name, url: s.signedUrl });
      }

      const { data: comp } = await supabase
        .from("company_settings").select("company_name").eq("user_id", user.id).maybeSingle();

      const data = {
        contactName: contactName || "klant",
        invoiceNumber: invoice.invoice_number,
        companyName: (comp as any)?.company_name ?? "",
        bodyText: invSendBody,
        downloadUrl,
        attachments,
        dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("nl-NL") : undefined,
        subject: invSendSubject,
      };

      const recipients = [invSendTo.trim()];
      const cc = invSendCc.trim();
      if (cc && cc !== invSendTo.trim()) recipients.push(cc);

      for (const rcpt of recipients) {
        await sendTransactionalEmail({
          templateName: "factuur-verzonden",
          recipientEmail: rcpt,
          idempotencyKey: `factuur-${invoice.id}-${rcpt}-${Date.now()}`,
          templateData: data,
        });
      }

      if (companyEmail) {
        await sendTransactionalEmail({
          templateName: "factuur-verzonden",
          recipientEmail: companyEmail,
          idempotencyKey: `factuur-bcc-${invoice.id}-${Date.now()}`,
          templateData: { ...data, subject: `[Kopie] ${invSendSubject}` },
        });
      }

      toast.success("Factuur verzonden");
    } catch (e: any) {
      toast.error("Versturen mislukt: " + (e?.message ?? e));
    } finally {
      setInvSending(false);
    }
  };

  if (authLoading || !user || !project) return null;


  return (
    <AppShell title={`Project ${project.project_number}`} subtitle={project.title || "Projectdossier"} back backTo="/projecten">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="quote">Offerte</TabsTrigger>
          <TabsTrigger value="verzenden">Verzenden</TabsTrigger>
          <TabsTrigger value="werkorder">Werkorder</TabsTrigger>
          <TabsTrigger value="factureren">Factureren</TabsTrigger>
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
                    <SelectItem value="te_factureren">Te factureren</SelectItem>
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
                     <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
                       <span>Status:</span> <Badge variant="secondary">{quote.status}</Badge> <span>·</span>
                       <span>Totaal:</span> <span className="font-medium">{fmt(Number(quote.total))}</span>
                     </div>
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
                      <Input
                        type="date"
                        value={woDate}
                        onChange={(e) => setWoDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Omschrijving werkzaamheden (conform offerte)</Label>
                    {quoteLines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Geen offerteregels gevonden. Voeg eerst regels toe aan de offerte.
                      </p>
                    ) : (
                      <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                        {quoteLines.map((l) => {
                          const qty = Number(l.quantity || 0);
                          const prefix = qty && qty !== 1 ? `${qty}${l.unit ? " " + l.unit : ""} - ` : "";
                          return (
                            <p key={l.id}>{prefix}{l.description}</p>
                          );
                        })}
                        <p className="mt-2 italic text-muted-foreground">
                          Werkzaamheden conform offerte uitgevoerd.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Voor akkoord: Naam</Label>
                    <Input
                      value={woSignerName}
                      onChange={(e) => setWoSignerName(e.target.value)}
                      placeholder="Naam klant"
                      autoComplete="name"
                      autoCapitalize="words"
                      inputMode="text"
                      className="h-11 text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Handtekening klant</Label>
                    <SignaturePad ref={sigRef} />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={generateWerkorderPdf} disabled={woSaving}>
                      <Save className="mr-1 h-4 w-4" />
                      {woSaving ? "Opslaan..." : "Akkoord & werkorder opslaan"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factureren">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Factuurtekst genereren (AI)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={generateInvText} disabled={genInvText}>
                    <Sparkles className="mr-1 h-4 w-4" />
                    {genInvText ? "Genereren..." : "Genereer factuurtekst met AI"}
                  </Button>
                </div>
                <Textarea
                  rows={10}
                  value={invoiceText}
                  onChange={(e) => setInvoiceText(e.target.value)}
                  placeholder="Tekst die op de factuur komt (intro, periode van uitvoering, dankwoord, betalingsinstructie). Genereer met AI of typ zelf."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Factuur genereren</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {invoice ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                     <p className="font-mono text-base">{invoice.invoice_number}</p>
                     <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
                       <span>Datum: {new Date(invoice.invoice_date).toLocaleDateString("nl-NL")}</span> <span>·</span>
                       <span>Vervalt: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("nl-NL") : "—"}</span> <span>·</span>
                       <span>Totaal:</span> <span className="font-medium">{fmt(Number(invoice.total))}</span> <span>·</span>
                       <span>Status:</span> <Badge variant="secondary">{invoice.status}</Badge>
                     </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nog geen factuur. Het volgende factuurnummer wordt automatisch opgehaald uit Instellingen → Nummering.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button onClick={generateInvoicePdf} disabled={genInvPdf || !invoiceText.trim()}>
                    <Receipt className="mr-1 h-4 w-4" />
                    {genInvPdf ? "Genereren..." : "Genereer factuur"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Factuur per e-mail versturen</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!invoice ? (
                  <p className="text-sm text-muted-foreground">Genereer eerst een factuur.</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Aan (e-mailadres)</Label>
                        <Input type="email" value={invSendTo} onChange={(e) => setInvSendTo(e.target.value)} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Bij zakelijke klant: factuurmailadres. Anders het hoofd e-mailadres.
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">CC (contactpersoon, optioneel)</Label>
                        <Input type="email" value={invSendCc} onChange={(e) => setInvSendCc(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Onderwerp</Label>
                      <Input value={invSendSubject} onChange={(e) => setInvSendSubject(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Mailtekst</Label>
                      <Textarea
                        rows={6}
                        value={invSendBody}
                        onChange={(e) => setInvSendBody(e.target.value)}
                        placeholder="Korte begeleidende tekst. De factuur en bijlagen worden als downloadlinks meegestuurd."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bijlagen (extra documenten naast de factuur)</Label>
                      <div className="space-y-1 rounded-md border p-3">
                         {docs.filter((d) => d.doc_type !== "factuur").length === 0 ? (
                          <p className="text-sm text-muted-foreground">Geen extra documenten beschikbaar.</p>
                        ) : (
                          docs.filter((d) => d.doc_type !== "factuur").map((d) => (
                            <label key={d.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={!!invAttachIds[d.id]}
                                onCheckedChange={(v) =>
                                  setInvAttachIds({ ...invAttachIds, [d.id]: Boolean(v) })
                                }
                              />
                              <Badge variant="outline" className="text-xs">{d.doc_type}</Badge>
                              <span className="truncate">{d.file_name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={sendFactuur} disabled={invSending}>
                        <Send className="mr-1 h-4 w-4" />
                        {invSending ? "Verzenden..." : "Factuur verzenden"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle className="text-base">Documenten</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr,1fr,auto]">
                <div className="space-y-1">
                  <Label htmlFor="doc-upload-name">Naam *</Label>
                  <Input
                    id="doc-upload-name"
                    placeholder="Bijv. Orderbevestiging"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="doc-upload-input">Bestand *</Label>
                  <Input
                    id="doc-upload-input"
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={uploadDoc} disabled={uploading || !uploadFile || !uploadName.trim()}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploaden..." : "Uploaden"}
                  </Button>
                </div>
              </div>
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