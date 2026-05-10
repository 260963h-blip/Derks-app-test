import { createServerFn } from "@tanstack/react-start";

type LineInput = {
  description: string;
  quantity: number;
  unit: string | null;
};

export const generateInvoiceText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as {
    customer_name: string;
    customer_type: string;
    quote_number?: string | null;
    project_title?: string | null;
    execution_dates?: string[];
    lines: LineInput[];
    company_name?: string | null;
    owner_name?: string | null;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");

    const summary = data.lines
      .map((l) => `- ${l.description} (${l.quantity} ${l.unit ?? ""})`)
      .join("\n");

    const periode =
      data.execution_dates && data.execution_dates.length
        ? data.execution_dates.join(", ")
        : "de afgesproken periode";

    const prompt = `Je schrijft een korte, professionele inleidende factuurtekst in het Nederlands voor een stukadoorsbedrijf.
De werkzaamheden zijn naar tevredenheid uitgevoerd. Bedank de klant en verwijs naar de uitgevoerde werkzaamheden conform offerte ${data.quote_number ?? ""}.
Noem de uitvoeringsperiode: ${periode}.
Vat de werkzaamheden kort samen op basis van onderstaande regels (uitsluitend stucwerk-terminologie). Noem GEEN prijzen.
Sluit af met een vriendelijke betalingsinstructie (zie onderstaande betalingsgegevens en termijn op de factuur).
BELANGRIJK: Voeg ZELF GEEN ondertekening of groet toe — die wordt apart toegevoegd.
Max ~140 woorden.

Klant: ${data.customer_name} (${data.customer_type})
${data.project_title ? `Project: ${data.project_title}\n` : ""}
Uitgevoerde werkzaamheden:
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
          { role: "system", content: "Je schrijft duidelijke Nederlandse factuurteksten voor een stukadoorsbedrijf." },
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
    if (data.owner_name) signLines.push(data.owner_name);
    if (data.company_name) signLines.push(data.company_name);
    text = `${text}\n\n${signLines.join("\n")}`;
    return { text };
  });
