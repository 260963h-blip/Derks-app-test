// Genereert een UBL 2.1 / NLCIUS-compatibele e-factuur XML (SI-UBL 2.0 stijl)
// Bedoeld voor Nederlandse facturen. Minimal-but-valid: bevat de verplichte
// BT-velden zodat boekhoudpakketten (Exact, Twinfield, e-Boekhouden, Peppol)
// het bestand kunnen importeren.

type Line = {
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  vat_rate?: number | null;
  line_total?: number | null;
};

type Company = Record<string, any>;
type Customer = Record<string, any> | null;
type Contact = Record<string, any> | null;

export type UblInvoiceInput = {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  subtotal: number;
  vatTotal: number;
  total: number;
  vatMode: "hoog" | "laag" | "geen" | "verlegd" | string;
  notes?: string;
  quoteNumber?: string | null;
  projectNumber?: string | null;
  company: Company;
  customer: Customer;
  contact: Contact;
  lines: Line[];
};

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const num = (n: unknown, d = 2) => Number(n ?? 0).toFixed(d);

const unitCode = (u?: string | null) => {
  const s = (u ?? "").toLowerCase().trim();
  if (!s) return "C62"; // dimensionless
  if (s.startsWith("uur") || s === "h") return "HUR";
  if (s === "stuk" || s === "stuks" || s === "st" || s === "pcs") return "C62";
  if (s === "m" || s === "meter") return "MTR";
  if (s === "m2" || s === "m²") return "MTK";
  if (s === "m3" || s === "m³") return "MTQ";
  if (s === "kg") return "KGM";
  if (s === "dag" || s === "dagen") return "DAY";
  return "C62";
};

const taxCategory = (mode: string, rate: number) => {
  // UBL/UNCL5305: S = standard, Z = zero, E = exempt, AE = reverse charge
  if (mode === "verlegd") return "AE";
  if (mode === "geen" || rate === 0) return "Z";
  return "S";
};

export function buildUblInvoiceXml(input: UblInvoiceInput): string {
  const c = input.company ?? {};
  const cust = input.customer ?? {};
  const contact = input.contact ?? {};
  const cat = taxCategory(input.vatMode, Number(c.default_vat_rate ?? 21));
  const defaultRate = Number(c.default_vat_rate ?? 21);

  const street = [c.address].filter(Boolean).join(" ");
  const custStreet =
    [cust?.street, cust?.house_number, cust?.house_number_addition].filter(Boolean).join(" ") ||
    cust?.address ||
    "";

  const linesXml = (input.lines.length > 0 ? input.lines : [{
    description: input.notes || `Factuur ${input.invoiceNumber}`,
    quantity: 1,
    unit: null,
    unit_price: input.subtotal,
    vat_rate: defaultRate,
    line_total: input.subtotal,
  }]).map((l, i) => {
    const qty = Number(l.quantity ?? 1);
    const price = Number(l.unit_price ?? 0);
    const lineTotal = Number(l.line_total ?? qty * price);
    const rate = Number(l.vat_rate ?? defaultRate);
    return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode(l.unit)}">${num(qty, 4)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${num(lineTotal)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc((l.description ?? "Regel").toString().slice(0, 250))}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${cat}</cbc:ID>
        <cbc:Percent>${num(cat === "S" ? rate : 0)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${num(price, 4)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join("\n");

  const partyVat = c.vat_number
    ? `\n      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(c.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : "";

  const custVat = cust?.vat_number
    ? `\n      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(cust.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : "";

  const payment = c.iban
    ? `\n  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${input.dueDate}</cbc:PaymentDueDate>
    <cbc:PaymentID>${esc(input.invoiceNumber)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(c.iban)}</cbc:ID>
      ${c.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(c.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : "";

  const orderRef = input.quoteNumber || input.projectNumber
    ? `\n  <cac:OrderReference><cbc:ID>${esc(input.quoteNumber || input.projectNumber)}</cbc:ID></cac:OrderReference>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${input.invoiceDate}</cbc:IssueDate>
  <cbc:DueDate>${input.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${input.notes ? `<cbc:Note>${esc(input.notes.slice(0, 1000))}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>${orderRef}
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${c.kvk_number ? `<cac:PartyIdentification><cbc:ID schemeID="0106">${esc(c.kvk_number)}</cbc:ID></cac:PartyIdentification>` : ""}
      <cac:PartyName><cbc:Name>${esc(c.company_name ?? "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(street)}</cbc:StreetName>
        <cbc:CityName>${esc(c.city ?? "")}</cbc:CityName>
        <cbc:PostalZone>${esc(c.postal_code ?? "")}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>NL</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${partyVat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(c.company_name ?? "")}</cbc:RegistrationName>
        ${c.kvk_number ? `<cbc:CompanyID schemeID="0106">${esc(c.kvk_number)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
      ${c.email ? `<cac:Contact><cbc:ElectronicMail>${esc(c.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(cust?.name ?? "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(custStreet)}</cbc:StreetName>
        <cbc:CityName>${esc(cust?.city ?? "")}</cbc:CityName>
        <cbc:PostalZone>${esc(cust?.postal_code ?? "")}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc((cust?.country_code ?? "NL")).toString().slice(0,2).toUpperCase()}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${custVat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(cust?.name ?? "")}</cbc:RegistrationName>
        ${cust?.kvk_number ? `<cbc:CompanyID schemeID="0106">${esc(cust.kvk_number)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
      ${(contact?.email || cust?.email) ? `<cac:Contact>${contact?.name ? `<cbc:Name>${esc(contact.name)}</cbc:Name>` : ""}<cbc:ElectronicMail>${esc(contact?.email || cust?.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>${payment}
  <cac:PaymentTerms><cbc:Note>Te voldoen voor ${input.dueDate}</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${num(input.vatTotal)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${num(input.subtotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${num(input.vatTotal)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${cat}</cbc:ID>
        <cbc:Percent>${num(cat === "S" ? defaultRate : 0)}</cbc:Percent>
        ${cat === "AE" ? "<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>BTW verlegd</cbc:TaxExemptionReason>" : ""}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${num(input.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${num(input.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${num(input.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${num(input.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>
`;
}