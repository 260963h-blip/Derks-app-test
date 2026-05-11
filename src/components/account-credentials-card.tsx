import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { createUserAccount } from "@/lib/user-accounts.functions";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  defaultEmail?: string;
  title?: string;
  description?: string;
};

export function AccountCredentialsCard({ defaultEmail = "", title = "Inloggegevens aanmaken", description }: Props) {
  const create = useServerFn(createUserAccount);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password !== confirm) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Je sessie is verlopen. Log opnieuw in.");
      }

      await create({ data: { email, password, accessToken: session.access_token } });
      toast.success("Account aangemaakt voor " + email);
      setPassword("");
      setConfirm("");
    } catch (e: any) {
      let msg = "Account aanmaken mislukt";
      try {
        if (e instanceof Response) {
          const text = await e.text();
          msg = text || `Fout (${e.status})`;
        } else if (typeof e?.message === "string" && e.message) {
          msg = e.message;
        } else if (typeof e === "string") {
          msg = e;
        }
      } catch {
        // ignore
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label>E-mailadres</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" />
          </div>
          <div className="space-y-2">
            <Label>Wachtwoord</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Bevestig wachtwoord</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={submit} disabled={busy || !email || !password}>
              {busy ? "Bezig..." : "Account aanmaken"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Met deze gegevens kan deze persoon inloggen op de app. Minimaal 6 tekens voor het wachtwoord.
        </p>
      </CardContent>
    </Card>
  );
}