import type { jsPDF } from "jspdf";

// Afbeelding ophalen als data-URL (logo / voettekst-afbeelding)
async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" }> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const format = (blob.type.includes("png") ? "PNG" : "JPEG") as "PNG" | "JPEG";
  return { dataUrl, format };
}

/**
 * Logo linksboven + bedrijfsgegevens rechts uitgelijnd.
 * Geeft de y-positie direct onder de koptekst terug.
 * Optie `includeIban` voegt de IBAN-regel toe (factuur).
 */
export async function tekenLogoEnBedrijfsgegevens(
  doc: jsPDF,
  company: Record<string, any> | null | undefined,
  opts: { includeIban?: boolean } = {},
): Promise<number> {
  const W = 210;
  const y = 15;

  // Logo links binnen marge
  const logoTop = y;
  const logoH = 28;
  if (company?.logo_url) {
    try {
      const { dataUrl, format } = await loadImageDataUrl(company.logo_url);
      doc.addImage(dataUrl, format, 15, logoTop, 50, logoH, undefined, "FAST");
    } catch {
      // logo niet geladen, ga door zonder
    }
  }

  // Bedrijfsgegevens rechts uitgelijnd
  const rightX = W - 15;
  doc.setFontSize(13).setFont("helvetica", "bold");
  doc.text(company?.company_name ?? "Bedrijf", rightX, y + 4, { align: "right" });
  doc.setFontSize(9).setFont("helvetica", "normal");
  const addrLines = [
    company?.address,
    [company?.postal_code, company?.city].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];
  addrLines.forEach((line, i) => doc.text(line, rightX, y + 9 + i * 4, { align: "right" }));
  const labeled: { label: string; value?: string | null }[] = [
    { label: "E-Mail", value: company?.email },
    { label: "KvK-nummer", value: company?.kvk_number },
    { label: "BTW-nummer", value: company?.vat_number },
    { label: "Telefoon", value: company?.phone },
  ];
  if (opts.includeIban) labeled.push({ label: "IBAN", value: company?.iban });
  let ly = y + 9 + addrLines.length * 4 + 2;
  for (const row of labeled) {
    if (!row.value) continue;
    doc.text(`${row.label}: ${row.value}`, rightX, ly, { align: "right" });
    ly += 4;
  }

  return Math.max(logoTop + logoH, ly) + 6;
}

/**
 * "Aan:"-blok met klantgegevens (links).
 * Optie `includeFiscalInfo` voegt BTW-/KvK-regels toe voor zakelijke klanten
 * en de T.a.v.-regel wordt getekend als `contact` meegegeven is.
 * Geeft de y-positie onder het blok terug.
 */
export function tekenKlantblok(
  doc: jsPDF,
  cust: Record<string, any> | null | undefined,
  contact: Record<string, any> | null | undefined,
  y: number,
  opts: { includeFiscalInfo?: boolean } = {},
): number {
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("Aan:", 15, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const custLines = [
    cust?.name,
    contact?.name ? `T.a.v. ${contact.name}` : null,
    [cust?.street, cust?.house_number, cust?.house_number_addition].filter(Boolean).join(" ") || cust?.address,
    [cust?.postal_code, cust?.city].filter(Boolean).join(" "),
    cust?.country,
    opts.includeFiscalInfo && cust?.customer_type === "zakelijk" && cust?.vat_number
      ? `BTW: ${cust.vat_number}`
      : null,
    opts.includeFiscalInfo && cust?.customer_type === "zakelijk" && cust?.kvk_number
      ? `KvK: ${cust.kvk_number}`
      : null,
  ].filter(Boolean) as string[];
  custLines.forEach((line, i) => doc.text(line, 15, y + 5 + i * 4));
  return y + 5 + custLines.length * 4 + 8;
}

/**
 * Voettekst onderaan de pagina: optionele afbeelding links, tekst rechts.
 * Tekst = company.footer_text, met `fallbackText` als die leeg is.
 */
export async function tekenVoettekst(
  doc: jsPDF,
  company: Record<string, any> | null | undefined,
  opts: { footerImageUrl?: string | null; fallbackText?: string | null } = {},
): Promise<void> {
  const W = 210;
  const footerY = 280;
  if (opts.footerImageUrl) {
    try {
      const { dataUrl, format } = await loadImageDataUrl(opts.footerImageUrl);
      doc.addImage(dataUrl, format, 15, footerY - 12, 30, 12, undefined, "FAST");
    } catch {
      // afbeelding niet geladen
    }
  }
  const footerText = company?.footer_text || opts.fallbackText;
  if (footerText) {
    const footer = doc.splitTextToSize(footerText, W - 60);
    doc.setFontSize(8).setTextColor(100);
    doc.text(footer, W - 15, footerY - 6, { align: "right" });
    doc.setTextColor(0);
  }
}
