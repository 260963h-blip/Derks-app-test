import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, LogIn, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  startMicrosoftConnect,
  completeMicrosoftConnection,
  microsoftStatus,
  disconnectMicrosoft,
  listPlanningFiles,
  listPlanningWorksheets,
  runPlanningSync,
} from "@/lib/planning-sync.functions";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.data?.connectorId !== "microsoft_excel" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("De Microsoft-koppeling is niet voltooid."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Het Microsoft-venster is gesloten voordat de koppeling klaar was."));
    }, 500);
  });
}

export function MicrosoftPlanningCard() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => { if (user) void init(); /* eslint-disable-next-line */ }, [user]);

  async function init() {
    try {
      const st = await microsoftStatus({ data: { accessToken: await token() } });
      setConnected(st.connected);
      const { data } = await supabase
        .from("company_settings")
        .select("planning_file_id,planning_file_name,planning_worksheet,planning_last_sync_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) {
        setFileId((data as any).planning_file_id ?? "");
        setFileName((data as any).planning_file_name ?? "");
        setSheet((data as any).planning_worksheet ?? "");
        setLastSync((data as any).planning_last_sync_at ?? null);
      }
      if (st.connected) void loadFiles();
    } catch (e) {
      // stil: koppeling nog niet ingesteld
    }
  }

  async function loadFiles() {
    try {
      const res = await listPlanningFiles({ data: { accessToken: await token() } });
      setFiles(res.files.map((f: any) => ({ id: f.id, name: f.name })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestanden ophalen mislukt");
    }
  }

  async function loadSheets(id: string) {
    try {
      const res = await listPlanningWorksheets({ data: { accessToken: await token(), fileId: id } });
      setSheets(res.sheets.map((s: any) => ({ id: s.id, name: s.name })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Werkbladen ophalen mislukt");
    }
  }

  async function connect() {
    setBusy(true);
    const popup = window.open("", "microsoft-oauth", "width=600,height=720");
    if (!popup) { setBusy(false); return toast.error("Sta pop-ups toe en probeer opnieuw."); }
    try {
      const { authorizationUrl } = await startMicrosoftConnect({ data: { accessToken: await token() } });
      const completion = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await completeMicrosoftConnection({ data: { accessToken: await token(), code } });
      setConnected(true);
      toast.success("Microsoft-account gekoppeld");
      await loadFiles();
    } catch (e) {
      popup.close();
      toast.error(e instanceof Error ? e.message : "Koppelen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectMicrosoft({ data: { accessToken: await token() } });
      setConnected(false);
      setFiles([]);
      toast.success("Koppeling verbroken");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verbreken mislukt");
    } finally { setBusy(false); }
  }

  async function saveChoice(nextFileId: string, nextName: string, nextSheet: string) {
    if (!user) return;
    const { data: existing } = await supabase
      .from("company_settings").select("id, company_name").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("company_settings").upsert({
      user_id: user.id,
      company_name: existing?.company_name ?? "",
      planning_file_id: nextFileId || null,
      planning_file_name: nextName || null,
      planning_worksheet: nextSheet || null,
    } as any, { onConflict: "user_id" });
    if (error) toast.error("Opslaan mislukt: " + error.message);
  }

  async function syncNow() {
    setBusy(true);
    try {
      const res = await runPlanningSync({ data: { accessToken: await token() } });
      toast.success(`Planning gelezen: ${res.rows} regels — ${res.nieuw} nieuw, ${res.gewijzigd} gewijzigd, ${res.verdwenen} verdwenen`);
      setLastSync(new Date().toISOString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verversen mislukt");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Microsoft planning (Vlassak)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Log in met je Microsoft-account om het gedeelde planningsbestand te mogen lezen.
            </p>
            <Button onClick={connect} disabled={busy}>
              <LogIn className="mr-2 h-4 w-4" /> Inloggen met Microsoft
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Planningsbestand</Label>
                <Select
                  value={fileId}
                  onValueChange={(v) => {
                    const f = files.find((x) => x.id === v);
                    setFileId(v);
                    setFileName(f?.name ?? "");
                    setSheet("");
                    void loadSheets(v);
                    void saveChoice(v, f?.name ?? "", "");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={fileName || "Kies bestand"} /></SelectTrigger>
                  <SelectContent>
                    {files.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Werkblad</Label>
                <Select
                  value={sheet}
                  onValueChange={(v) => { setSheet(v); void saveChoice(fileId, fileName, v); }}
                  disabled={!fileId}
                >
                  <SelectTrigger><SelectValue placeholder={sheet || "Eerste werkblad"} /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={syncNow} disabled={busy || !fileId}>
                <RefreshCw className="mr-2 h-4 w-4" /> Ververs planning nu
              </Button>
              <Button variant="outline" onClick={loadFiles} disabled={busy}>Bestandenlijst vernieuwen</Button>
              <Button variant="ghost" onClick={disconnect} disabled={busy}>
                <Unlink className="mr-2 h-4 w-4" /> Koppeling verbreken
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lastSync ? `Laatst gecontroleerd: ${new Date(lastSync).toLocaleString("nl-NL")}` : "Nog niet gecontroleerd."}
              {" "}De planning wordt daarnaast elk uur automatisch gecontroleerd.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
