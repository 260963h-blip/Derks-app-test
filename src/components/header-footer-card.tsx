import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

type ImgItem = { id: string; label: string; image_url: string };

export function HeaderFooterCard({
  title,
  description,
  text,
  imageUrl,
  logoUrl,
  onTextChange,
  onImageChange,
}: {
  title: string;
  description: string;
  text: string;
  imageUrl: string;
  logoUrl: string;
  onTextChange: (v: string) => void;
  onImageChange: (v: string) => void;
}) {
  const [items, setItems] = useState<ImgItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("company_images")
        .select("id,label,image_url")
        .order("created_at", { ascending: false });
      setItems((data ?? []) as ImgItem[]);
    })();
  }, []);

  const choices: { key: string; label: string; url: string }[] = [];
  if (logoUrl) choices.push({ key: "logo", label: "Logo", url: logoUrl });
  for (const it of items) {
    choices.push({ key: it.id, label: it.label || "Afbeelding", url: it.image_url });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          <Label>Tekst</Label>
          <Textarea rows={3} value={text} onChange={(e) => onTextChange(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Afbeelding</Label>
          {imageUrl && (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex h-20 w-32 items-center justify-center bg-muted/30">
                <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onImageChange("")}>
                <X className="mr-1 h-4 w-4" /> Verwijderen
              </Button>
            </div>
          )}
          {choices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload eerst een logo of extra afbeelding om te kunnen kiezen.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {choices.map((c) => {
                const active = c.url === imageUrl;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onImageChange(c.url)}
                    className={
                      "rounded-md border p-2 text-left transition-colors " +
                      (active ? "border-primary ring-2 ring-primary" : "hover:bg-muted/50")
                    }
                  >
                    <div className="flex h-16 items-center justify-center bg-muted/30">
                      <img src={c.url} alt={c.label} className="max-h-full max-w-full object-contain" />
                    </div>
                    <p className="mt-1 truncate text-xs">{c.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}