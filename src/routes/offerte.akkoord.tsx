import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getQuoteByApprovalToken,
  approveQuoteByApprovalToken,
} from "@/lib/quote-approval.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/offerte/akkoord")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: OfferteAkkoordPage,
});

function OfferteAkkoordPage() {
  const { token } = useSearch({ from: "/offerte/akkoord" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    id: string;
    quote_number: string;
    status: string;
    total: number;
    approved_at: string | null;
  } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Geen geldige link.");
        setLoading(false);
        return;
      }
      try {
        const data = await getQuoteByApprovalToken({ data: { token } });
        setQuote(data);
        if (data.status === "akkoord" || data.approved_at) setDone(true);
      } catch {
        setError("Deze offerte kon niet worden gevonden.");
      }
      setLoading(false);
    })();
  }, [token]);

  const confirm = async () => {
    if (!quote || !token) return;
    if (!window.confirm("Weet u zeker dat u akkoord gaat met deze offerte?")) return;
    setSubmitting(true);
    try {
      await approveQuoteByApprovalToken({ data: { token } });
      setDone(true);
    } catch (e) {
      setError("Akkoord registreren mislukt. Probeer het later opnieuw.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Offerte akkoord</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Laden...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : done ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <p className="font-medium">Bedankt! Uw akkoord is geregistreerd.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Offerte {quote?.quote_number} staat nu op akkoord. We nemen zo spoedig mogelijk
                contact met u op voor de planning.
              </p>
            </div>
          ) : quote ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Offertenummer</p>
                <p className="text-lg font-semibold">{quote.quote_number}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Totaalbedrag</p>
                <p className="text-lg font-semibold">
                  € {Number(quote.total).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-sm">
                Door op "Ja, ik ga akkoord" te klikken bevestigt u akkoord te gaan met deze offerte.
              </p>
              <div className="flex gap-2">
                <Button onClick={confirm} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Ja, ik ga akkoord
                </Button>
                <Button variant="outline" onClick={() => window.close()}>Annuleren</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}