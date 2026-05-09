import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuoteByToken, approveQuoteByToken } from "@/lib/offerte-akkoord.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/offerte-akkoord/$token")({
  component: OfferteAkkoordPage,
});

type Quote = {
  id: string;
  quote_number: string;
  status: string;
  total: number;
  approved_at: string | null;
  project_id: string | null;
};

function OfferteAkkoordPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchQuote = useServerFn(getQuoteByToken);
  const doApprove = useServerFn(approveQuoteByToken);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchQuote({ data: { token } });
        if (!data) setError("Deze akkoordlink is niet (meer) geldig.");
        else setQuote(data as Quote);
      } catch (e: any) {
        setError("Deze akkoordlink is niet (meer) geldig.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, fetchQuote]);

  const approve = async () => {
    if (!quote) return;
    setSubmitting(true);
    try {
      const res = await doApprove({ data: { token } });
      setQuote({ ...quote, status: "akkoord", approved_at: res.approved_at });
    } catch (e: any) {
      setError("Akkoord geven mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Offerte akkoord</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Laden...
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : quote && (quote.approved_at || quote.status === "akkoord") ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Bedankt, uw akkoord is geregistreerd.</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Offerte <span className="font-mono">{quote.quote_number}</span> · {fmt(Number(quote.total))}
              </p>
            </div>
          ) : quote ? (
            <div className="space-y-3">
              <p className="text-sm">
                U staat op het punt akkoord te geven op offerte{" "}
                <span className="font-mono font-medium">{quote.quote_number}</span> ter waarde van{" "}
                <span className="font-medium">{fmt(Number(quote.total))}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Door op "Akkoord geven" te klikken bevestigt u dat u akkoord bent met de offerte
                en geeft u opdracht tot uitvoering.
              </p>
              <Button className="w-full" onClick={approve} disabled={submitting}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {submitting ? "Bezig..." : "Akkoord geven"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}