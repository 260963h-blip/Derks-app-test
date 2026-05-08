import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/bedrijfsgegevens")({
  component: BedrijfsgegevensPage,
});

type Form = {
  company_name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  kvk_number: string;
  vat_number: string;
  iban: string;
  bic: string;
  default_vat_rate: string;
  default_payment_term_days: string;
  default_quote_validity_days: string;
  quote_footer: string;
  invoice_footer: string;
};

const empty: Form = {
  company_name: "",
  address: "",
  postal_code: "",
  city: "",
  country: "Nederland",
  phone: "",
  email: "",
  website: "",
  kvk_number: "",
  vat_number: "",
  iban: "",
  bic: "",
  default_vat_rate: "21",
  default_payment_term_days: "14",
  default_quote_validity_days: "30",
  quote_footer: "",
  invoice_footer: "",
};

function BedrijfsgegevensPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Kon gegevens niet laden");
      } else if (data) {
        setForm({
          company_name: data.company_name ?? "",
          address: data.address ?? "",
          postal_code: data.postal_code ?? "",
          city: data.city ?? "",
          country: data.country ?? "Nederland",
          phone: data.phone ?? "",
          email: data.email ?? "",
          website: data.website ?? "",
          kvk_number: data.kvk_number ?? "",
          vat_number: data.vat_number ?? "",
          iban: data.iban ?? "",
          bic: data.bic ?? "",
          default_vat_rate: String(data.default_vat_rate ?? 21),
          default_payment_term_days: String(data.default_payment_term_days ?? 14),
          default_quote_validity_days: String(data.default_quote_validity_days ?? 30),
          quote_footer: data.quote_footer ?? "",
          invoice_footer: data.invoice_footer ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.company_name.trim()) {
      toast.error("Bedrijfsnaam is verplicht");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      company_name: form.company_name.trim(),
      address: form.address || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      country: form.country || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      kvk_number: form.kvk_number || null,
      vat_number: form.vat_number || null,
      iban: form.iban || null,
      bic: form.bic || null,
      default_vat_rate: Number(form.default_vat_rate) || 21,
      default_payment_term_days: Number(form.default_payment_term_days) || 14,
      default_quote_validity_days: Number(form.default_quote_validity_days) || 30,
      quote_footer: form.quote_footer || null,
      invoice_footer: form.invoice_footer || null,
    };
    const { error } = await supabase
      .from("company_settings")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error("Opslaan mislukt: " + error.message);
    else toast.success("Bedrijfsgegevens opgeslagen");
  };

  return (
    <AppShell title="Bedrijfsgegevens" subtitle="Deze gegevens komen op je offertes en facturen" back>
      {loading ? (
        <p className="text-muted-foreground">Laden...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Field label="Bedrijfsnaam *" v={form.company_name} on={(v) => set("company_name", v)} />
              <Field label="E-mail" v={form.email} on={(v) => set("email", v)} type="email" />
              <Field label="Telefoon" v={form.phone} on={(v) => set("phone", v)} />
              <Field label="Website" v={form.website} on={(v) => set("website", v)} />
              <Field label="Adres" v={form.address} on={(v) => set("address", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Postcode" v={form.postal_code} on={(v) => set("postal_code", v)} />
                <Field label="Plaats" v={form.city} on={(v) => set("city", v)} />
              </div>
              <Field label="Land" v={form.country} on={(v) => set("country", v)} />
              <Field label="KvK-nummer" v={form.kvk_number} on={(v) => set("kvk_number", v)} />
              <Field label="BTW-nummer" v={form.vat_number} on={(v) => set("vat_number", v)} />
              <Field label="IBAN" v={form.iban} on={(v) => set("iban", v)} />
              <Field label="BIC" v={form.bic} on={(v) => set("bic", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <Field label="Standaard BTW %" v={form.default_vat_rate} on={(v) => set("default_vat_rate", v)} type="number" />
              <Field label="Betaaltermijn (dagen)" v={form.default_payment_term_days} on={(v) => set("default_payment_term_days", v)} type="number" />
              <Field label="Offerte geldig (dagen)" v={form.default_quote_validity_days} on={(v) => set("default_quote_validity_days", v)} type="number" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="space-y-2">
                <Label>Voettekst offerte</Label>
                <Textarea rows={3} value={form.quote_footer} onChange={(e) => set("quote_footer", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Voettekst factuur</Label>
                <Textarea rows={3} value={form.invoice_footer} onChange={(e) => set("invoice_footer", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  );
}

function Field({
  label,
  v,
  on,
  type = "text",
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}