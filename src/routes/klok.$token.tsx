import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, LogIn, LogOut } from "lucide-react";
import { fetchClockState, doClockIn, doClockOut } from "@/lib/time-clock.functions";
import type { ClockState } from "@/lib/time-clock.server";
import logo from "@/assets/logo-derks.png";

export const Route = createFileRoute("/klok/$token")({
  head: () => ({
    meta: [
      { title: "In- en uitklokken | Stucadoorsbedrijf Derks" },
      { name: "description", content: "Klok in of uit via de QR-code van het bedrijf." },
      { property: "og:title", content: "In- en uitklokken | Stucadoorsbedrijf Derks" },
      { property: "og:description", content: "Klok in of uit via de QR-code van het bedrijf." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KlokPage,
});

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function KlokPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [state, setState] = useState<ClockState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: `/klok/${token}` } });
    }
  }, [loading, user, token, navigate]);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";
    if (!accessToken) return;
    try {
      const res = await fetchClockState({ data: { token, accessToken } });
      setState(res);
    } catch (err: any) {
      toast.error(err?.message ?? "Er ging iets mis");
    }
  }, [token]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function action(kind: "in" | "out") {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? "";
      const fn = kind === "in" ? doClockIn : doClockOut;
      const res = await fn({ data: { token, accessToken } });
      setConfirmation(
        kind === "in"
          ? `Ingeklokt om ${fmtTime(res.at)}`
          : `Uitgeklokt om ${fmtTime(res.at)}`,
      );
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Er ging iets mis");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <img src={logo} alt="Stucadoorsbedrijf Derks" className="mx-auto h-16 w-auto" />

        {!state.company ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-xl font-bold text-destructive">Deze QR-code is niet geldig</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-6 text-center">
                <h1 className="text-3xl font-bold leading-tight">{state.company.name}</h1>
                {state.employee && (
                  <p className="mt-3 text-base font-medium">{state.employee.name}</p>
                )}
              </CardContent>
            </Card>

            {confirmation && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-4 text-center text-lg font-semibold">
                <CheckCircle2 className="h-6 w-6" /> {confirmation}
              </div>
            )}

            {!state.employee ? (
              <Card>
                <CardContent className="p-6 text-center text-lg">
                  {state.error ?? "Klokken is niet mogelijk met dit account."}
                </CardContent>
              </Card>
            ) : state.openEntry ? (
              <div className="space-y-4">
                <p className="text-center text-lg">
                  Je bent ingeklokt sinds <strong>{fmtTime(state.openEntry.clock_in_at)}</strong>
                </p>
                <Button
                  className="h-24 w-full text-2xl font-bold"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => action("out")}
                >
                  <LogOut className="mr-3 h-8 w-8" /> Uitklokken
                </Button>
              </div>
            ) : (
              <Button
                className="h-24 w-full text-2xl font-bold"
                disabled={busy}
                onClick={() => action("in")}
              >
                <LogIn className="mr-3 h-8 w-8" /> Inklokken
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
