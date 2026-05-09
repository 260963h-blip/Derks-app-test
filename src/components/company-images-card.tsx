import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "company-assets";

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function LogoUploadCard({
  logoUrl,
  onChange,
}: {
  logoUrl: string;
  onChange: (url: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!user) return;
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    setBusy(false);
    if (error) {
      toast.error("Upload mislukt: " + error.message);
      return;
    }
    onChange(publicUrl(path));
    toast.success("Logo geüpload — vergeet niet op te slaan");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-lg font-semibold">Bedrijfslogo</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-32 w-48 items-center justify-center rounded-md border bg-muted/30">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Geen logo</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              PNG of JPG met transparante of witte achtergrond werkt het best in offertes en facturen.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                <Upload className="mr-2 h-4 w-4" />
                {busy ? "Uploaden..." : logoUrl ? "Logo vervangen" : "Logo uploaden"}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" onClick={() => onChange("")}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijderen
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ExtraImage = {
  id: string;
  label: string;
  image_url: string;
  file_path: string;
};

export function ExtraImagesCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<ExtraImage[]>([]);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    const { data, error } = await supabase
      .from("company_images")
      .select("id,label,image_url,file_path")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Kon afbeeldingen niet laden");
      return;
    }
    setItems((data ?? []) as ExtraImage[]);
  }

  async function add() {
    if (!user || !file) {
      toast.error("Kies een bestand");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/img-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
    });
    if (upErr) {
      setBusy(false);
      toast.error("Upload mislukt: " + upErr.message);
      return;
    }
    const url = publicUrl(path);
    const { error: insErr } = await supabase.from("company_images").insert({
      user_id: user.id,
      label: label.trim(),
      image_url: url,
      file_path: path,
    });
    setBusy(false);
    if (insErr) {
      toast.error("Opslaan mislukt: " + insErr.message);
      return;
    }
    setLabel("");
    setFile(null);
    const inp = document.getElementById("extra-img-input") as HTMLInputElement | null;
    if (inp) inp.value = "";
    toast.success("Afbeelding toegevoegd");
    load();
  }

  async function remove(it: ExtraImage) {
    if (!confirm(`"${it.label || "Afbeelding"}" verwijderen?`)) return;
    await supabase.storage.from(BUCKET).remove([it.file_path]);
    const { error } = await supabase.from("company_images").delete().eq("id", it.id);
    if (error) {
      toast.error("Verwijderen mislukt");
      return;
    }
    toast.success("Verwijderd");
    load();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-1 text-lg font-semibold">Extra afbeeldingen</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Bijvoorbeeld certificaten, keurmerken of huisstijl-banners voor je offertes en facturen.
        </p>

        <div className="mb-4 grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="bv. KOMO certificaat" />
          </div>
          <div>
            <Label>Bestand</Label>
            <Input
              id="extra-img-input"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="button" onClick={add} disabled={busy}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {busy ? "Uploaden..." : "Toevoegen"}
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            Nog geen extra afbeeldingen.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((it) => (
              <div key={it.id} className="group relative rounded-md border p-2">
                <div className="flex h-24 items-center justify-center bg-muted/30">
                  <img src={it.image_url} alt={it.label} className="max-h-full max-w-full object-contain" />
                </div>
                <p className="mt-2 truncate text-xs">{it.label || "—"}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove(it)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}