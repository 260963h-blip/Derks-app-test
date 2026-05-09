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
import { Upload, Trash2, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/bedrijfsgegevens")({
  component: BedrijfsgegevensPage,
});

type Form = {
  company_name: string;
  logo_url: string;
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
  owner_first_name: string;
  owner_middle_name: string;
  owner_last_name: string;
  owner_date_of_birth: string;
  owner_bsn: string;
  owner_street: string;
  owner_house_number: string;
  owner_house_number_addition: string;
  owner_postal_code: string;
  owner_city: string;
  owner_phone: string;
  owner_email: string;
};

const empty: Form = {
  company_name: "",
  logo_url: "",
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
  owner_first_name: "",
  owner_middle_name: "",
  owner_last_name: "",
  owner_date_of_birth: "",
  owner_bsn: "",
  owner_street: "",
  owner_house_number: "",
  owner_house_number_addition: "",
  owner_postal_code: "",
  owner_city: "",
  owner_phone: "",
  owner_email: "",
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
          logo_url: data.logo_url ?? "",
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
          owner_first_name: data.owner_first_name ?? "",
          owner_middle_name: data.owner_middle_name ?? "",
          owner_last_name: data.owner_last_name ?? "",
          owner_date_of_birth: data.owner_date_of_birth ?? "",
          owner_bsn: data.owner_bsn ?? "",
          owner_street: data.owner_street ?? "",
          owner_house_number: data.owner_house_number ?? "",
          owner_house_number_addition: data.owner_house_number_addition ?? "",
          owner_postal_code: data.owner_postal_code ?? "",
          owner_city: data.owner_city ?? "",
          owner_phone: data.owner_phone ?? "",
          owner_email: data.owner_email ?? "",
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
      logo_url: form.logo_url || null,
      owner_first_name: form.owner_first_name || null,
      owner_middle_name: form.owner_middle_name || null,
      owner_last_name: form.owner_last_name || null,
      owner_date_of_birth: form.owner_date_of_birth || null,
      owner_bsn: form.owner_bsn || null,
      owner_street: form.owner_street || null,
      owner_house_number: form.owner_house_number || null,
      owner_house_number_addition: form.owner_house_number_addition || null,
      owner_postal_code: form.owner_postal_code || null,
      owner_city: form.owner_city || null,
      owner_phone: form.owner_phone || null,
      owner_email: form.owner_email || null,
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
            <CardContent className="pt-6">
              <h3 className="mb-4 text-lg font-semibold">Eigenaar</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Voornaam" v={form.owner_first_name} on={(v) => set("owner_first_name", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tussenvoegsel" v={form.owner_middle_name} on={(v) => set("owner_middle_name", v)} />
                  <Field label="Achternaam" v={form.owner_last_name} on={(v) => set("owner_last_name", v)} />
                </div>
                <Field label="Geboortedatum" v={form.owner_date_of_birth} on={(v) => set("owner_date_of_birth", v)} type="date" />
                <Field label="BSN" v={form.owner_bsn} on={(v) => set("owner_bsn", v)} />
                <Field label="Straat" v={form.owner_street} on={(v) => set("owner_street", v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Huisnr." v={form.owner_house_number} on={(v) => set("owner_house_number", v)} />
                  <Field label="Toevoeging" v={form.owner_house_number_addition} on={(v) => set("owner_house_number_addition", v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Postcode" v={form.owner_postal_code} on={(v) => set("owner_postal_code", v)} />
                  <Field label="Plaats" v={form.owner_city} on={(v) => set("owner_city", v)} />
                </div>
                <Field label="Telefoon" v={form.owner_phone} on={(v) => set("owner_phone", v)} />
                <Field label="E-mail" v={form.owner_email} on={(v) => set("owner_email", v)} type="email" />
              </div>
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