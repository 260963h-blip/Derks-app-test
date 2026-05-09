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
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    const summary = data.lines
      .map((l) => `- [${l.line_type}] ${l.description} (${l.quantity} ${l.unit ?? ""})`)
      .join("\n");

    const prompt = `Je bent een professionele schilder/stukadoor die een offerte schrijft in het Nederlands.
Schrijf een korte, professionele inleidende offertetekst (max ~150 woorden) gericht aan de klant.
Beschrijf duidelijk welke werkzaamheden worden uitgevoerd op basis van onderstaande regels.
Vat ruimtes samen (bv. "Toilet en keuken: beide 4 wanden en plafond schilderen").
Noem geen prijzen. Gebruik een vriendelijke, zakelijke toon. Sluit af met een uitnodiging tot akkoord.

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
          { role: "system", content: "Je schrijft duidelijke Nederlandse offerteteksten." },
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
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text };
  });