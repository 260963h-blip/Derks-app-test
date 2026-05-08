import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

type Doc = {
  id: string;
  document_type: string;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
};

const DOC_TYPES = [
  { value: "id_bewijs", label: "ID-bewijs" },
  { value: "contract", label: "Arbeidsovereenkomst" },
  { value: "loonstrook", label: "Loonstrook" },
  { value: "polis", label: "Verzekeringspolis" },
  { value: "arbo", label: "Arbo / medische keuring" },
  { value: "diploma", label: "Diploma / certificaat" },
  { value: "verlof", label: "Verlof / vakantie" },
  { value: "ziekte", label: "Ziekteverzuim" },
  { value: "overig", label: "Overig" },
];

function typeLabel(v: string) {
  return DOC_TYPES.find((t) => t.value === v)?.label ?? v;
}

function formatSize(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function EmployeeDocumentsDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState("contract");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && employeeId) load();
  }, [open, employeeId]);

  async function load() {
    if (!employeeId) return;
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Kon documenten niet laden");
      return;
    }
    setDocs((data ?? []) as Doc[]);
  }

  async function upload() {
    if (!user || !employeeId || !file) {
      toast.error("Kies eerst een bestand");
      return;
    }
    if (!title.trim()) {
      toast.error("Geef het document een titel");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${user.id}/${employeeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("employee-documents")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("Upload mislukt: " + upErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("employee_documents").insert({
      user_id: user.id,
      employee_id: employeeId,
      document_type: docType,
      title: title.trim(),
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
    });
    setUploading(false);
    if (insErr) {
      toast.error("Opslaan mislukt: " + insErr.message);
      return;
    }
    toast.success("Document geüpload");
    setTitle("");
    setFile(null);
    const input = document.getElementById("doc-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
    load();
  }

  async function download(d: Doc) {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(d.file_path, 60);
    if (error || !data) {
      toast.error("Download mislukt");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function remove(d: Doc) {
    if (!confirm(`"${d.title}" verwijderen?`)) return;
    await supabase.storage.from("employee-documents").remove([d.file_path]);
    const { error } = await supabase.from("employee_documents").delete().eq("id", d.id);
    if (error) {
      toast.error("Verwijderen mislukt");
      return;
    }
    toast.success("Document verwijderd");
    load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Documenten – {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <h3 className="mb-3 font-semibold">Nieuw document uploaden</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Titel *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="bv. Contract Jan Janssen"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>Bestand *</Label>
              <Input
                id="doc-file-input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, afbeelding of Word-bestand. Maximaal 50 MB.
              </p>
            </div>
            <Button className="mt-3" onClick={upload} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploaden..." : "Uploaden"}
            </Button>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Documenten in dossier ({docs.length})</h3>
            {docs.length === 0 ? (
              <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                Nog geen documenten geüpload.
              </p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{d.title}</p>
                          <Badge variant="secondary" className="shrink-0">
                            {typeLabel(d.document_type)}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.file_name} · {formatSize(d.file_size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => download(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
