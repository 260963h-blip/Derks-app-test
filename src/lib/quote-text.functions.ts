import { createServerFn } from "@tanstack/react-start";

type LineInput = {
  line_type: string;
  description: string;
  quantity: number;
  unit: string | null;
};

export const generateQuoteText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as {
    customer_name: string;
    customer_type: string;
    lines: LineInput[];
    reference?: string | null;
    company_name?: string | null;
    owner_name?: string | null;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    const summary = data.lines
      .map((l) => `- [${l.line_type}] ${l.description} (${l.quantity} ${l.unit ?? ""})`)
      .join("\n");

    const prompt = `Je bent een professionele stukadoor die een offerte schrijft in het Nederlands.
Het bedrijf voert UITSLUITEND stucwerk uit. Geen schilderwerk, geen sauswerk, geen behang, geen tegelwerk, geen andere disciplines.
Schrijf een korte, professionele inleidende offertetekst (max ~150 woorden) gericht aan de klant.
Beschrijf duidelijk welke stucwerkzaamheden worden uitgevoerd op basis van onderstaande regels.
Vat ruimtes samen (bv. "Toilet en keuken: beide 4 wanden en plafond stucen").
Gebruik uitsluitend stucwerk-terminologie (bv. stucen, pleisteren, uitvlakken, glad afwerken, sausklaar opleveren).
Noem nooit schilderen, sauzen, behangen of andere niet-stucwerk werkzaamheden, ook niet als de regelteksten dat lijken te suggereren.
Noem geen prijzen. Gebruik een vriendelijke, zakelijke toon. Sluit af met een uitnodiging tot akkoord.
BELANGRIJK: Voeg ZELF GEEN ondertekening, groet of afsluitende naamregel toe — die wordt apart toegevoegd.

Klant: ${data.customer_name} (${data.customer_type})
${data.reference ? `Referentie: ${data.reference}\n` : ""}
Werkzaamheden:
${summary}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Je schrijft duidelijke Nederlandse offerteteksten voor een stukadoorsbedrijf dat uitsluitend stucwerk uitvoert. Vermeld nooit schilderwerk, sauswerk, behang of andere disciplines." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit bereikt, probeer later opnieuw.");
      if (res.status === 402) throw new Error("AI credits op. Voeg credits toe in de workspace.");
      throw new Error(`AI fout: ${res.status} ${txt}`);
    }

    const json = await res.json();
    let text: string = json?.choices?.[0]?.message?.content ?? "";
    text = text.replace(/\s*$/, "");
    const signLines = ["Met vriendelijke groet,", ""];
    if (data.company_name) signLines.push(data.company_name);
    if (data.owner_name) signLines.push(data.owner_name);
    text = `${text}\n\n${signLines.join("\n")}`;
    return { text };
  });