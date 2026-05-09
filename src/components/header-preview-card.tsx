import { Card, CardContent } from "@/components/ui/card";

export function HeaderPreviewCard({
  logoUrl,
  companyName,
  address,
  postalCode,
  city,
  email,
  kvk,
  vat,
  phone,
}: {
  logoUrl: string;
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  kvk: string;
  vat: string;
  phone: string;
}) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-end gap-2 text-[11px] leading-tight">
      <span className="font-medium">{label}:</span>
      <span>{value || "-"}</span>
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-lg font-semibold">Koptekst</h3>
          <p className="text-sm text-muted-foreground">
            Wordt automatisch gevuld met je bedrijfsgegevens. Logo links, gegevens rechts uitgelijnd.
          </p>
        </div>

        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-32 w-40 items-center justify-start">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-32 max-w-full object-contain" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
                  Geen logo
                </div>
              )}
            </div>
            <div className="flex h-32 flex-1 flex-col items-end justify-center text-right">
              <div className="text-xs font-semibold leading-tight">{companyName || "Bedrijfsnaam"}</div>
              <div className="text-[11px] leading-tight">{address || "-"}</div>
              <div className="text-[11px] leading-tight">
                {postalCode} {city}
              </div>
              <div className="mt-1 space-y-0.5">
                <Row label="E-Mail" value={email} />
                <Row label="KvK-nummer" value={kvk} />
                <Row label="BTW-nummer" value={vat} />
                <Row label="Telefoon" value={phone} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}