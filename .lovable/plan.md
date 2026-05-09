## Doel

We stappen over van losse "klant + offerte" naar **projecten als centrale entiteit**. Elk project heeft één uniek **projectnummer** dat tegelijk dient als offertenummer (en later factuurnummer-basis). Binnen een project verzamelen we alle documenten: offerte-pdf, werkorder-pdf en factuur-pdf — het projectdossier.

---

## Nieuwe structuur (concept)

```
Project (projectnummer = offertenummer)
├── Klant (nieuw of bestaand, gekoppeld aan project)
├── Offerte (1 per project, status: concept → definitief → akkoord)
│   └── offerte.pdf  (opgeslagen in dossier)
├── Werkorder (na akkoord, status: gepland → uitgevoerd)
│   └── werkorder.pdf
└── Factuur (na uitvoering)
    └── factuur.pdf
```

---

## Stappenplan

### Stap 1 — Database

- Nieuwe tabel **`projects`**: projectnummer (= offertenummer), titel, klant_id, contact_id, status (`nieuw` / `offerte` / `akkoord` / `in_uitvoering` / `afgerond` / `gefactureerd`), aanmaakdatum, notities.
- **`quotes`** krijgt verplichte `project_id` (1-op-1 met project).
- Nieuwe tabel **`work_orders`** (project_id, datum, uitvoerder, status, notities).
- Nieuwe tabel **`invoices`** (project_id, factuurnummer, datum, vervaldatum, status, bedragen).
- Nieuwe tabel **`project_documents`** (project_id, type: `offerte` / `werkorder` / `factuur` / `overig`, bestandsnaam, file_path in storage, versie, aangemaakt_op).
- Storage bucket **`project-documents`** (privé, RLS per gebruiker).
- Nummering: `company_settings.quote_number_next` wordt hergebruikt als **projectnummer-teller**; factuurnummer blijft eigen reeks.

### Stap 2 — Nieuwe flow: project aanmaken

Nieuwe route **`/projecten`** (lijst) en **`/projecten/$id`** (dossier).

Wizard bij "Nieuw project":
1. **Klant kiezen of nieuw aanmaken** (bestaande klantvelden, inline formulier).
2. Project-titel + referentie invullen → projectnummer wordt automatisch gegenereerd.
3. Project wordt aangemaakt → meteen door naar het projectdossier.

### Stap 3 — Offerte binnen project

- De bestaande offerte-editor verhuist naar een tab **"Offerte"** binnen het projectdossier.
- Offertenummer = projectnummer (read-only).
- Bij **"Definitieve offerte genereren"** wordt de pdf opgeslagen in storage onder `projects/{projectnummer}/offerte-v{n}.pdf` en als rij in `project_documents` vastgelegd.
- Elke nieuwe generatie = nieuwe versie (oude blijven bewaard in dossier).

### Stap 4 — Projectdossier UI

Tabbladen binnen `/projecten/$id`:
- **Overzicht** — klant, status, totalen, snelle acties.
- **Offerte** — editor + pdf-versies.
- **Werkorder** — (stap 5).
- **Factuur** — (stap 6).
- **Documenten** — alle pdf's chronologisch, downloadbaar.

### Stap 5 — Werkorder (later uit te bouwen)

- Knop "Werkorder aanmaken" zodra offerte = akkoord.
- Eenvoudig formulier (datum, medewerkers, opmerkingen) → genereert werkorder.pdf → opgeslagen in dossier.

### Stap 6 — Factuur (later uit te bouwen)

- Knop "Factuur aanmaken" na uitvoering, neemt regels over uit offerte.
- Genereert factuur.pdf met eigen factuurnummer → opgeslagen in dossier.

### Stap 7 — Migratie bestaande offertes

- Voor elke bestaande offerte automatisch een project aanmaken met hetzelfde nummer en dezelfde klant, zodat niets verloren gaat.
- Menu "Offertes" wordt vervangen door "Projecten" (of beide naast elkaar in de overgang).

---

## Volgorde van uitvoeren

1. Stap 1 (database) — migratie schrijven, jij keurt goed.
2. Stap 2 + 3 + 4 — nieuwe `/projecten` route, wizard, dossier met offerte-tab + pdf-opslag.
3. Stap 7 — migratie van bestaande offertes naar projecten.
4. Stap 5 — werkorder.
5. Stap 6 — factuur.

---

## Vragen voor jou

1. **Projectnummer-format**: zelfde als nu (`2026-0001`)? Of een eigen prefix zoals `P2026-0001`?
2. **Factuurnummer**: aparte doorlopende reeks (bv. `F2026-0001`) of gelijk aan projectnummer?
3. **Mogen bestaande offertes automatisch omgezet worden** naar projecten (stap 7), of wil je dat handmatig doen?
4. Akkoord om met **stap 1 (databasemigratie)** te beginnen?
