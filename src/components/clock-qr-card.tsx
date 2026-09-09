import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

export function ClockQrCard({ token, companyName }: { token: string | null; companyName: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  if (!token) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Inklokken</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Geen QR-token gevonden. Vul eerst je bedrijfsgegevens in.
          </p>
        </CardContent>
      </Card>
    );
  }

  const url = `${window.location.origin}/klok/${token}`;

  const getCanvas = () => wrapRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const download = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "inklokken-qr.png";
    a.click();
  };

  const print = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    setPrinting(true);
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) {
      setPrinting(false);
      return;
    }
    win.document.write(`<!doctype html><html><head><title>QR-code Inklokken</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh; margin: 0; }
        img { width: 420px; height: 420px; }
        h1 { font-size: 32px; margin: 24px 0 8px; }
        p { font-size: 22px; margin: 0; color: #333; }
      </style></head><body>
      <img src="${dataUrl}" alt="QR-code inklokken" />
      <h1>Scan hier om in of uit te klokken</h1>
      <p>${companyName}</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
      setPrinting(false);
    };
    setTimeout(() => setPrinting(false), 3000);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Inklokken</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hang deze QR-code op de werklocatie. Medewerkers scannen hem om in of uit te klokken.
        </p>
        <div className="flex flex-col items-center gap-3 rounded-lg border p-6">
          <div ref={wrapRef}>
            <QRCodeCanvas value={url} size={240} includeMargin level="M" />
          </div>
          <p className="text-center text-lg font-semibold">Scan hier om in of uit te klokken</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={download} className="flex-1">
            <Download className="mr-2 h-4 w-4" /> Download als afbeelding
          </Button>
          <Button onClick={print} disabled={printing} className="flex-1">
            <Printer className="mr-2 h-4 w-4" /> Afdrukken (A4)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
