import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Save, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateQuoteText } from "@/lib/quote-text.functions";

export const Route = createFileRoute("/offertes/$id")({
  component: OfferteEditor,
});

type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  contact_id: string | null;
  reference: string | null;
  status: string;
  quote_date: string;
  valid_until: string | null;
  notes: string | null;
  vat_mode: string;
  project_id: string | null;
};

type Line = {
  id: string;
  line_type: "artikel" | "medewerker" | "ruimte";
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  sort_order: number;
};

type Customer = { id: string; name: string; customer_type: string };
type Contact = { id: string; customer_id: string; name: string; email: string | null; phone: string | null };
type Article = { id: string; name: string; price: number; vat_rate: number; unit: string | null; unit_label: string | null };
type Employee = { id: string; first_name: string; last_name: string; role: string };
type Rate = { id: string; employee_id: string; name: string; hourly_rate: number; is_default: boolean };
type Room = {
  id: string;
  name: string;
  price_per_m2: number;
  vat_rate: number;
  default_m2: number | null;
  pricing_type: "per_m2" | "fixed";
  fixed_price: number;
  default_walls: number;
  include_ceiling: boolean;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

// Bepaal het BTW-tarief voor een regel op basis van klanttype, gekozen vat_mode
// en het regeltype. Materiaal/ruimten blijven bij particulier-laag op 21%,
// alleen uren van medewerkers krijgen 9%.
function vatForLine(
  customerType: string | undefined,
  vatMode: string,
  lineType: "artikel" | "medewerker" | "ruimte"
): number {
  if (customerType === "zakelijk") {
    return vatMode === "verlegd" ? 0 : 21;
  }
  // particulier
  if (vatMode === "laag") {
    return lineType === "medewerker" ? 9 : 21;
  }
  return 21;
}

function OfferteEditor() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [pickArticle, setPickArticle] = useState<string>("");
  const [artQty, setArtQty] = useState<string>("1");
  const [pickEmployee, setPickEmployee] = useState<string>("");
  const [pickRate, setPickRate] = useState<string>("");
  const [empHours, setEmpHours] = useState<string>("1");
  const [pickRoom, setPickRoom] = useState<string>("");
  const [roomM2, setRoomM2] = useState<string>("");
  const [roomWalls, setRoomWalls] = useState<string>("");
  const [roomCeiling, setRoomCeiling] = useState<boolean>(false);
  const [roomPricingMode, setRoomPricingMode] = useState<"per_m2" | "fixed">("per_m2");

  const [saving, setSaving] = useState(false);
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const genQuoteText = useServerFn(generateQuoteText);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const load = async () => {
    const [{ data: q, error: qe }, { data: ls }, { data: cs }, { data: arts }, { data: emps }, { data: rs }, { data: rms }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
      supabase.from("quote_lines").select("*").eq("quote_id", id).order("sort_order"),
      supabase.from("customers").select("id,name,customer_type").order("name"),
      supabase.from("articles").select("id,name,price,vat_rate,unit,unit_label").eq("is_active", true).order("name"),
      supabase.from("employees").select("id,first_name,last_name,role").order("first_name"),
      supabase.from("employee_rates").select("id,employee_id,name,hourly_rate,is_default").order("sort_order"),
      supabase.from("rooms").select("id,name,price_per_m2,vat_rate,default_m2,pricing_type,fixed_price,default_walls,include_ceiling").eq("is_active", true).order("sort_order").order("name"),
    ]);
    if (qe || !q) {
      toast.error("Offerte niet gevonden");
      navigate({ to: "/offertes" });
      return;
    }
    setQuote(q as Quote);
    setLines((ls ?? []) as Line[]);
    setCustomers((cs ?? []) as Customer[]);
    if ((q as Quote).customer_id) {
      const { data: ctx } = await supabase
        .from("customer_contacts")
        .select("id,customer_id,name,email,phone")
        .eq("customer_id", (q as Quote).customer_id!)
        .order("name");
      setContacts((ctx ?? []) as Contact[]);
    }
    setArticles((arts ?? []) as Article[]);
    setEmployees((emps ?? []) as Employee[]);
    setRates((rs ?? []) as Rate[]);
    setRooms((rms ?? []) as Room[]);
  };

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === quote?.customer_id),
    [customers, quote?.customer_id]
  );

  const onCustomerChange = async (v: string) => {
    if (!quote) return;
    const { data: cust } = await supabase
      .from("customers")
      .select("customer_type")
      .eq("id", v)
      .maybeSingle();
    const newType = (cust?.customer_type as string) ?? "particulier";
    // reset vat_mode naar standaard 'hoog' bij andere klantsoort
    const nextMode =
      newType === "zakelijk"
        ? quote.vat_mode === "verlegd" || quote.vat_mode === "hoog"
          ? quote.vat_mode
          : "hoog"
        : quote.vat_mode === "laag" || quote.vat_mode === "hoog"
          ? quote.vat_mode
          : "hoog";
    setQuote({ ...quote, customer_id: v, contact_id: null, vat_mode: nextMode });
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        vat_rate: vatForLine(newType, nextMode, l.line_type),
      }))
    );
    const { data } = await supabase
      .from("customer_contacts")
      .select("id,customer_id,name,email,phone")
      .eq("customer_id", v)
      .order("name");
    setContacts((data ?? []) as Contact[]);
  };

  const onVatModeChange = (mode: string) => {
    if (!quote) return;
    setQuote({ ...quote, vat_mode: mode });
    const ct = selectedCustomer?.customer_type;
    setLines((prev) =>
      prev.map((l) => ({ ...l, vat_rate: vatForLine(ct, mode, l.line_type) }))
    );
  };

  const totals = useMemo(() => {
    let sub = 0;
    const byRate = new Map<number, number>();
    for (const l of lines) {
      const lt = Number(l.quantity) * Number(l.unit_price);
      sub += lt;
      const rate = Number(l.vat_rate) || 0;
      const v = (lt * rate) / 100;
      byRate.set(rate, (byRate.get(rate) ?? 0) + v);
    }
    const vatBreakdown = Array.from(byRate.entries())
      .filter(([rate, amount]) => rate > 0 && amount !== 0)
      .sort((a, b) => a[0] - b[0])
      .map(([rate, amount]) => ({ rate, amount }));
    const vat = vatBreakdown.reduce((s, b) => s + b.amount, 0);
    return { sub, vat, total: sub + vat, vatBreakdown };
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => {
      const copy = [...prev];
      const merged = { ...copy[idx], ...patch };
      merged.line_total = Number(merged.quantity) * Number(merged.unit_price);
      copy[idx] = merged;
      return copy;
    });
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addArticleLine = () => {
    const a = articles.find((x) => x.id === pickArticle);
    if (!a) return;
    const qty = Number(artQty) || 0;
    if (qty <= 0) return;
    const vr = vatForLine(selectedCustomer?.customer_type, quote!.vat_mode, "artikel");
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        line_type: "artikel",
        description: a.name,
        quantity: qty,
        unit: a.unit_label || a.unit,
        unit_price: Number(a.price),
        vat_rate: vr,
        line_total: qty * Number(a.price),
        sort_order: prev.length,
      },
    ]);
    setPickArticle("");
    setArtQty("1");
  };

  const employeeRates = useMemo(
    () => rates.filter((r) => r.employee_id === pickEmployee),
    [rates, pickEmployee]
  );

  useEffect(() => {
    const def = employeeRates.find((r) => r.is_default) ?? employeeRates[0];
    setPickRate(def?.id ?? "");
  }, [pickEmployee, employeeRates]);

  const addEmployeeLine = () => {
    const e = employees.find((x) => x.id === pickEmployee);
    const r = rates.find((x) => x.id === pickRate);
    const hrs = Number(empHours) || 0;
    if (!e || !r || hrs <= 0) return;
    const desc = `${e.first_name} ${e.last_name} — ${r.name}`;
    const vr = vatForLine(selectedCustomer?.customer_type, quote!.vat_mode, "medewerker");
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        line_type: "medewerker",
        description: desc,
        quantity: hrs,
        unit: "uur",
        unit_price: Number(r.hourly_rate),
        vat_rate: vr,
        line_total: hrs * Number(r.hourly_rate),
        sort_order: prev.length,
      },
    ]);
    setPickEmployee("");
    setPickRate("");
    setEmpHours("1");
  };

  const addRoomLine = () => {
    const r = rooms.find((x) => x.id === pickRoom);
    if (!r) return;
    const vr = vatForLine(selectedCustomer?.customer_type, quote!.vat_mode, "ruimte");
    const walls = Number(roomWalls) || 0;
    const descParts: string[] = [];
    if (walls > 0) descParts.push(`${walls} ${walls === 1 ? "wand" : "wanden"}`);
    if (roomCeiling) descParts.push("incl. plafond");
    const extra = descParts.length ? ` (${descParts.join(", ")})` : "";
    if (roomPricingMode === "fixed") {
      const price = Number(r.fixed_price);
      setLines((prev) => [
        ...prev,
        {
          id: `tmp-${crypto.randomUUID()}`,
          line_type: "ruimte",
          description: r.name + extra,
          quantity: 1,
          unit: "stuk",
          unit_price: price,
          vat_rate: vr,
          line_total: price,
          sort_order: prev.length,
        },
      ]);
    } else {
      const m2 = Number(roomM2) || 0;
      if (m2 <= 0) return;
      setLines((prev) => [
        ...prev,
        {
          id: `tmp-${crypto.randomUUID()}`,
          line_type: "ruimte",
          description: r.name + extra,
          quantity: m2,
          unit: "m²",
          unit_price: Number(r.price_per_m2),
          vat_rate: vr,
          line_total: m2 * Number(r.price_per_m2),
          sort_order: prev.length,
        },
      ]);
    }
    setPickRoom("");
    setRoomM2("");
    setRoomWalls("");
    setRoomCeiling(false);
  };

  const save = async () => {
    if (!quote || !user) return;
    setSaving(true);
    try {
      const { error: qe } = await supabase
        .from("quotes")
        .update({
          customer_id: quote.customer_id,
          contact_id: quote.contact_id,
          reference: quote.reference,
          vat_mode: quote.vat_mode,
          status: quote.status,
          quote_date: quote.quote_date,
          valid_until: quote.valid_until,
          notes: quote.notes,
          subtotal: totals.sub,
          vat_total: totals.vat,
          total: totals.total,
        })
        .eq("id", quote.id);
      if (qe) throw qe;

      await supabase.from("quote_lines").delete().eq("quote_id", quote.id);
      if (lines.length) {
        const payload = lines.map((l, i) => ({
          user_id: user.id,
          quote_id: quote.id,
          line_type: l.line_type,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          vat_rate: l.vat_rate,
          line_total: Number(l.quantity) * Number(l.unit_price),
          sort_order: i,
        }));
        const { error: le } = await supabase.from("quote_lines").insert(payload);
        if (le) throw le;
      }
      toast.success("Offerte opgeslagen");
      load();
    } catch (e: any) {
      toast.error("Opslaan mislukt: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user || !quote) return null;

  const handleGenerateText = async () => {
    if (!quote || !selectedCustomer) {
      toast.error("Selecteer eerst een klant");
      return;
    }
    if (lines.length === 0) {
      toast.error("Voeg eerst regels toe");
      return;
    }
    setGeneratingText(true);
    try {
      const { data: comp } = await supabase
        .from("company_settings")
        .select("company_name, owner_first_name, owner_middle_name, owner_last_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      const ownerName = [comp?.owner_first_name, comp?.owner_middle_name, comp?.owner_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const { text } = await genQuoteText({
        data: {
          customer_name: selectedCustomer.name,
          customer_type: selectedCustomer.customer_type,
          reference: quote.reference,
          lines: lines.map((l) => ({
            line_type: l.line_type,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
          })),
          company_name: comp?.company_name ?? null,
          owner_name: ownerName || null,
        },
      });
      setQuoteText(text);
      toast.success("Tekst gegenereerd — pas aan en klik 'Genereer offerte definitief'");
    } catch (e: any) {
      toast.error("Genereren mislukt: " + (e?.message ?? e));
    } finally {
      setGeneratingText(false);
    }
  };

  const generatePdf = async () => {
    if (!quote || !selectedCustomer) {
      toast.error("Selecteer eerst een klant");
      return;
    }
    if (!quoteText.trim()) {
      toast.error("Genereer of typ eerst de offertetekst");
      return;
    }
    setGeneratingPdf(true);
    try {
      const [{ data: company }, { data: cust }, contactRes] = await Promise.all([
        supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("customers").select("*").eq("id", quote.customer_id!).maybeSingle(),
        quote.contact_id
          ? supabase.from("customer_contacts").select("*").eq("id", quote.contact_id).maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);

      const text = quoteText;

      const { jsPDF } = await import("jspdf");
      // jspdf-autotable niet meer nodig: regeloverzicht is verwijderd uit PDF
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      let y = 15;

      // Logo links binnen marge
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
        } catch {
          // logo niet geladen, ga door zonder
        }
      }

      // Bedrijfsgegevens rechts uitgelijnd
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

      // Klantblok
      doc.setFontSize(10).setFont("helvetica", "bold");
      doc.text("Aan:", 15, y);
      doc.setFont("helvetica", "normal").setFontSize(9);
      const custLines = [
        cust?.name,
        contactRes.data?.name ? `T.a.v. ${contactRes.data.name}` : null,
        [cust?.street, cust?.house_number, cust?.house_number_addition].filter(Boolean).join(" ") || cust?.address,
        [cust?.postal_code, cust?.city].filter(Boolean).join(" "),
        cust?.country,
        cust?.customer_type === "zakelijk" && cust?.vat_number ? `BTW: ${cust.vat_number}` : null,
        cust?.customer_type === "zakelijk" && cust?.kvk_number ? `KvK: ${cust.kvk_number}` : null,
      ].filter(Boolean) as string[];
      custLines.forEach((line, i) => doc.text(line, 15, y + 5 + i * 4));
      y += 5 + custLines.length * 4 + 8;

      // Titel + meta
      doc.setFontSize(14).setFont("helvetica", "bold");
      doc.text(`Offerte ${quote.quote_number}`, 15, y);
      doc.setFontSize(9).setFont("helvetica", "normal");
      doc.text(`Datum: ${quote.quote_date}`, W - 15, y, { align: "right" });
      if (quote.valid_until) doc.text(`Geldig tot: ${quote.valid_until}`, W - 15, y + 5, { align: "right" });
      if (quote.reference) doc.text(`Referentie: ${quote.reference}`, 15, y + 5);
      y += 10;
      // Donkerblauwe scheidingslijn onder referentie/geldigheidsduur
      doc.setDrawColor(10, 36, 99);
      doc.setLineWidth(0.5);
      doc.line(15, y, W - 15, y);
      doc.setDrawColor(0);
      y += 5;

      // Gegenereerde tekst — strikt binnen de marges van 15 mm
      doc.setFontSize(10);
      const maxTextWidth = W - 30; // 210 - 2*15 = 180 mm
      // Breek extreem lange "woorden"/URLs zodat splitTextToSize ze ook kan wikkelen
      const breakLong = (s: string, max = 80) =>
        s.split(/(\s+)/).map((w) => (w.length > max ? w.replace(new RegExp(`(.{${max}})`, "g"), "$1\u200B") : w)).join("");
      const safeText = breakLong(text).replace(/\u200B/g, " ");
      const wrapped = doc.splitTextToSize(safeText, maxTextWidth);
      doc.text(wrapped, 15, y, { maxWidth: maxTextWidth });
      y += wrapped.length * 5 + 6;

      // Totalen (zonder regeloverzicht)
      const xLabel = W - 80;
      const xVal = W - 15;
      doc.setFontSize(10);
      doc.text("Subtotaal", xLabel, y);
      doc.text(fmt(totals.sub), xVal, y, { align: "right" });
      y += 5;
      if (quote.vat_mode === "verlegd") {
        doc.text("BTW verlegd", xLabel, y);
        doc.text("—", xVal, y, { align: "right" });
        y += 5;
      } else if (totals.vatBreakdown.length === 0) {
        doc.text("BTW", xLabel, y);
        doc.text(fmt(0), xVal, y, { align: "right" });
        y += 5;
      } else {
        for (const b of totals.vatBreakdown) {
          doc.text(`BTW ${b.rate}%`, xLabel, y);
          doc.text(fmt(b.amount), xVal, y, { align: "right" });
          y += 5;
        }
      }
      // Streep tussen BTW en totaal
      doc.setLineWidth(0.3);
      doc.line(xLabel, y - 2, xVal, y - 2);
      doc.setFont("helvetica", "bold");
      doc.text("Totaal incl. BTW", xLabel, y + 1);
      doc.text(fmt(totals.total), xVal, y + 1, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 10;

      // Voettekst (afbeelding + tekst) uit bedrijfsgegevens
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
        } catch {
          // afbeelding niet geladen
        }
      }
      const footerText = (company as any)?.footer_text || company?.quote_footer;
      if (footerText) {
        const footer = doc.splitTextToSize(footerText, W - 60);
        doc.setFontSize(8).setTextColor(100);
        doc.text(footer, W - 15, footerY - 6, { align: "right" });
        doc.setTextColor(0);
      }

      const fileName = `Offerte-${quote.quote_number}.pdf`;
      // Lokaal downloaden
      doc.save(fileName);

      // Opslaan in projectdossier (storage + project_documents)
      if (quote.project_id) {
        try {
          const blob = doc.output("blob");
          // bepaal volgende versie
          const { data: existing } = await supabase
            .from("project_documents")
            .select("version")
            .eq("project_id", quote.project_id)
            .eq("doc_type", "offerte")
            .order("version", { ascending: false })
            .limit(1);
          const nextVersion = ((existing?.[0]?.version as number) ?? 0) + 1;
          const path = `${user.id}/${quote.project_id}/offerte-v${nextVersion}-${quote.quote_number}.pdf`;
          const { error: upErr } = await supabase.storage
            .from("project-documents")
            .upload(path, blob, { contentType: "application/pdf", upsert: false });
          if (upErr) throw upErr;
          await supabase.from("project_documents").insert({
            user_id: user.id,
            project_id: quote.project_id,
            doc_type: "offerte",
            file_name: `Offerte-${quote.quote_number}-v${nextVersion}.pdf`,
            file_path: path,
            version: nextVersion,
            mime_type: "application/pdf",
            file_size: blob.size,
          });
          toast.success(`Offerte PDF gegenereerd en opgeslagen in dossier (v${nextVersion})`);
        } catch (e: any) {
          toast.error("PDF lokaal gedownload, maar opslaan in dossier mislukt: " + (e?.message ?? e));
        }
      } else {
        toast.success("Offerte PDF gegenereerd");
      }
    } catch (e: any) {
      toast.error("Genereren mislukt: " + (e?.message ?? e));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <AppShell title={`Offerte ${quote.quote_number}`} subtitle="Stel de offerte samen" back backTo="/offertes">
      <div className="space-y-6">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Nummer</Label>
              <Input value={quote.quote_number} readOnly className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Datum</Label>
              <Input
                type="date"
                value={quote.quote_date}
                onChange={(e) => setQuote({ ...quote, quote_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Geldig tot</Label>
              <Input
                type="date"
                value={quote.valid_until ?? ""}
                onChange={(e) => setQuote({ ...quote, valid_until: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={quote.status || "concept"} onValueChange={(v) => setQuote({ ...quote, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="verzonden">Verzonden</SelectItem>
                  <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
                  <SelectItem value="akkoord">Akkoord</SelectItem>
                  <SelectItem value="afgewezen">Afgewezen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label className="text-xs">Klant</Label>
              <Select
                value={quote.customer_id ?? undefined}
                onValueChange={onCustomerChange}
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
            {selectedCustomer?.customer_type === "zakelijk" && (
              <>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Contactpersoon</Label>
                  <Select
                    value={quote.contact_id ?? undefined}
                    onValueChange={(v) => setQuote({ ...quote, contact_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={contacts.length === 0 ? "Geen contactpersonen" : "Kies contactpersoon..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.email ? ` — ${c.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Referentie</Label>
                  <Input
                    value={quote.reference ?? ""}
                    onChange={(e) => setQuote({ ...quote, reference: e.target.value })}
                    placeholder="bv. inkoopordernummer of project"
                  />
                </div>
              </>
            )}
            {selectedCustomer && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Label className="text-xs">BTW-toepassing</Label>
                <Select value={quote.vat_mode || "hoog"} onValueChange={onVatModeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoog">BTW hoog 21%</SelectItem>
                    {selectedCustomer.customer_type === "zakelijk" && (
                      <SelectItem value="verlegd">BTW verlegd 0%</SelectItem>
                    )}
                    {selectedCustomer.customer_type !== "zakelijk" && (
                      <SelectItem value="laag">BTW laag 9% (alleen op uren — materiaal/ruimten 21%)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Toevoegen</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Artikel</Label>
              <Select value={pickArticle || undefined} onValueChange={setPickArticle}>
                <SelectTrigger><SelectValue placeholder="Kies artikel..." /></SelectTrigger>
                <SelectContent>
                  {articles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {fmt(Number(a.price))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Aantal"
                  value={artQty}
                  onChange={(e) => setArtQty(e.target.value)}
                />
                <Button size="sm" onClick={addArticleLine} disabled={!pickArticle}>
                  <Plus className="mr-1 h-4 w-4" /> Toevoegen
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Medewerker</Label>
              <Select value={pickEmployee || undefined} onValueChange={setPickEmployee}>
                <SelectTrigger><SelectValue placeholder="Kies medewerker..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} {e.role === "eigenaar" ? "(eigenaar)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickEmployee && (
                <Select value={pickRate || undefined} onValueChange={setPickRate}>
                  <SelectTrigger><SelectValue placeholder="Kies tarief..." /></SelectTrigger>
                  <SelectContent>
                    {employeeRates.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Geen tarieven</div>
                    ) : employeeRates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — {fmt(Number(r.hourly_rate))}/uur
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Uren"
                  value={empHours}
                  onChange={(e) => setEmpHours(e.target.value)}
                />
                <Button size="sm" onClick={addEmployeeLine} disabled={!pickEmployee || !pickRate}>
                  <Plus className="mr-1 h-4 w-4" /> Toevoegen
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Ruimte</Label>
              <Select value={pickRoom || undefined} onValueChange={(v) => {
                setPickRoom(v);
                const r = rooms.find((x) => x.id === v);
                const hasM2 = !!r && Number(r.price_per_m2) > 0;
                const hasFixed = !!r && Number(r.fixed_price) > 0;
                const mode: "per_m2" | "fixed" = hasM2 ? "per_m2" : hasFixed ? "fixed" : "per_m2";
                setRoomPricingMode(mode);
                if (mode === "per_m2" && r?.default_m2) setRoomM2(String(r.default_m2));
                else setRoomM2("");
                setRoomWalls(r?.default_walls ? String(r.default_walls) : "");
                setRoomCeiling(!!r?.include_ceiling);
              }}>
                <SelectTrigger><SelectValue placeholder="Kies ruimte..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {Number(r.price_per_m2) > 0 ? ` — ${fmt(Number(r.price_per_m2))}/m²` : ""}
                      {Number(r.fixed_price) > 0 ? ` — ${fmt(Number(r.fixed_price))} vast` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickRoom && (
                <div className="space-y-2 rounded-md border p-2">
                  {(() => {
                    const r = rooms.find((x) => x.id === pickRoom);
                    const hasM2 = !!r && Number(r.price_per_m2) > 0;
                    const hasFixed = !!r && Number(r.fixed_price) > 0;
                    if (!hasM2 || !hasFixed) return null;
                    return (
                      <div>
                        <Label className="text-xs">Prijstype</Label>
                        <Select
                          value={roomPricingMode}
                          onValueChange={(v) => setRoomPricingMode(v as "per_m2" | "fixed")}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_m2">Per m² ({fmt(Number(r!.price_per_m2))}/m²)</SelectItem>
                            <SelectItem value="fixed">Vast bedrag ({fmt(Number(r!.fixed_price))})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Aantal wanden</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={roomWalls}
                        onChange={(e) => setRoomWalls(e.target.value)}
                      />
                    </div>
                    {roomPricingMode !== "fixed" && (
                      <div>
                        <Label className="text-xs">m²</Label>
                        <Input
                          type="number"
                          placeholder="m²"
                          value={roomM2}
                          onChange={(e) => setRoomM2(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={roomCeiling}
                      onCheckedChange={(v) => setRoomCeiling(!!v)}
                    />
                    Plafond meenemen
                  </label>
                  <div className="flex">
                    <Button size="sm" onClick={addRoomLine} disabled={!pickRoom} className="ml-auto">
                      <Plus className="mr-1 h-4 w-4" /> Toevoegen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Regels</CardTitle></CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen regels.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Type</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="w-[90px]">Aantal</TableHead>
                    <TableHead className="w-[60px]">Eenh.</TableHead>
                    <TableHead className="w-[110px]">Prijs</TableHead>
                    <TableHead className="w-[80px]">BTW%</TableHead>
                    <TableHead className="w-[110px] text-right">Totaal</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs uppercase text-muted-foreground">{l.line_type}</TableCell>
                      <TableCell>
                        <Input
                          value={l.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.unit ?? ""}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={l.unit_price}
                          onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={l.vat_rate}
                          onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(Number(l.quantity) * Number(l.unit_price))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
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

        <Card>
          <CardContent className="pt-6">
            <div className="ml-auto max-w-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotaal</span>
                <span>{fmt(totals.sub)}</span>
              </div>
              {quote.vat_mode === "verlegd" ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BTW verlegd</span>
                  <span>—</span>
                </div>
              ) : totals.vatBreakdown.length === 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BTW</span>
                  <span>{fmt(0)}</span>
                </div>
              ) : (
                totals.vatBreakdown.map((b) => (
                  <div key={b.rate} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BTW {b.rate}%</span>
                    <span>{fmt(b.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <span>Totaal</span>
                <span>{fmt(totals.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offertetekst</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Genereer een conceptbeschrijving op basis van de regels. Pas hem naar wens aan.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateText}
                disabled={generatingText || lines.length === 0 || !selectedCustomer}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {generatingText ? "Genereren..." : quoteText ? "Opnieuw genereren" : "Genereer tekst"}
              </Button>
            </div>
            <Textarea
              rows={10}
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder="Klik op 'Genereer tekst' of typ hier zelf de offertetekst..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/offertes" })}>Terug</Button>
          <Button variant="secondary" onClick={generatePdf} disabled={generatingPdf || !quoteText.trim()}>
            <FileText className="mr-1 h-4 w-4" /> {generatingPdf ? "Genereren..." : "Genereer offerte definitief"}
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}