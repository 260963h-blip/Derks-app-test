## Artikelen module

We bouwen een artikelenbeheer met twee soorten artikelen:

### 1. Materialen (BTW hoog 21%)
Gewone producten met categorie, subcategorie, eenheid en prijs.

### 2. Werkzaamheden per ruimte (BTW laag 9%)
Diensten gekoppeld aan een ruimte (Keuken, Woonkamer, Slaapkamer, Badkamer, …) met dynamische invoervelden (aantal wanden, m², kleur, type stucwerk, etc.).

---

### Database

**Tabel `articles`** (gemeenschappelijk voor beide types):
- `article_type` — `materiaal` of `werkzaamheid`
- `category` — bv. "Materialen" of ruimtenaam ("Keuken", "Woonkamer", "Badkamer", …)
- `subcategory` — bv. "Hoekstukken", "Zakken stuc", "Stukadoren wanden"
- `name` — naam van het artikel/werkzaamheid
- `description` — vrije tekst
- `unit` — `stuk`, `zak`, `liter`, `rol`, `m2`, `wand`, `ja_nee`, …
- `unit_label` — vrije tekst voor weergave (bv. "per zak (25kg)")
- `vat_rate` — 21 of 9 (default afhankelijk van type)
- `price` — verkoopprijs per eenheid
- `cost_price` — inkoopprijs (optioneel)
- `field_schema` — JSONB array van extra invoervelden (alleen werkzaamheden), bv:
  ```json
  [
    { "key": "aantal_wanden", "label": "Aantal wanden", "type": "number" },
    { "key": "hoogte", "label": "Hoogte wanden (m)", "type": "number" },
    { "key": "kleur", "label": "Kleur", "type": "text" },
    { "key": "type_stucwerk", "label": "Type stucwerk", "type": "select", "options": ["glad","structuur"] },
    { "key": "plafond", "label": "Plafond", "type": "boolean" },
    { "key": "opp_plafond", "label": "Opp. plafond (m²)", "type": "number" }
  ]
  ```
- `is_active` — boolean
- standard `user_id`, RLS, timestamps

**Seed-data** met de voorbeelden die je gaf (Hoekprofiel 2m, Stucmortel, Primer, Latex verf, Behang 10m², plus de werkzaamheden per ruimte).

---

### UI: `/artikelen`

Eén pagina met twee tabbladen:

**Tab "Materialen"**
- Tabel: Categorie / Subcategorie / Naam / Eenheid / Prijs / BTW
- Filter op subcategorie (Hoekstukken, Zakken stuc, Voorstrijk, Verf, Behang)
- Dialog voor nieuw/bewerken met velden: subcategorie, naam, eenheid, prijs, BTW (default 21%)

**Tab "Werkzaamheden"**
- Tabel: Ruimte / Werkzaamheid / Eenheid / Prijs / BTW
- Filter op ruimte (Keuken, Woonkamer, Slaapkamer, Badkamer, …)
- Dialog voor nieuw/bewerken met:
  - Ruimte (select + vrije invoer)
  - Werkzaamheid (naam)
  - Eenheid + label
  - Prijs, BTW (default 9%)
  - **Veldenbouwer**: lijst van extra invoervelden die later bij offerte/calculatie ingevuld worden (key, label, type: number/text/select/boolean, opties)

Tegel "Artikelen" toevoegen op het dashboard.

---

### Stappen
1. Migratie `articles` tabel + RLS + trigger updated_at
2. Seed voorbeelddata
3. Route `/artikelen` met tabs, lijst + dialog
4. Tegel op dashboard

Akkoord? Dan zet ik stap 1 (migratie) klaar.