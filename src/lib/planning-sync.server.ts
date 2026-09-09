import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getConnectionKeyForUser } from "@/lib/app-user-connections.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "microsoft_excel";
export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Files.Read",
  "Files.Read.All",
];

/* ---------------- Excel helpers ---------------- */

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 80000) return null;
  const ms = Math.round(serial) * 86400000 + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, mei: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
};

function parseDateCell(value: unknown, text: string, fallbackYear: number): string | null {
  if (typeof value === "number") {
    const iso = excelSerialToDate(value);
    if (iso) return iso;
  }
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    return iso(y, Number(m[2]), Number(m[1]));
  }
  m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/(\d{1,2})\s+([a-z]{3,})/);
  if (m) {
    const mon = MONTHS[m[2]!.slice(0, 3)];
    if (mon) return iso(fallbackYear, mon, Number(m[1]));
  }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return iso(fallbackYear, Number(m[2]), Number(m[1]));
  return null;
}

function iso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function graph(connectionAPIKey: string, path: string): Promise<any> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Microsoft Excel (${res.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function listExcelFiles(userId: string) {
  const keyValue = await requireKey(userId);
  const data = await graph(
    keyValue,
    "/me/drive/root/search(q='.xlsx')?$top=50&$select=id,name,lastModifiedDateTime",
  );
  return ((data.value ?? []) as any[])
    .filter((f) => typeof f.name === "string" && f.name.toLowerCase().endsWith(".xlsx"))
    .map((f) => ({ id: f.id as string, name: f.name as string, modified: f.lastModifiedDateTime as string }));
}

export async function listWorksheets(userId: string, fileId: string) {
  const keyValue = await requireKey(userId);
  const data = await graph(keyValue, `/me/drive/items/${fileId}/workbook/worksheets?$select=id,name`);
  return ((data.value ?? []) as any[]).map((w) => ({ id: w.id as string, name: w.name as string }));
}

async function requireKey(userId: string): Promise<string> {
  const k = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!k) throw new Error("Geen Microsoft-koppeling gevonden. Log eerst in met Microsoft.");
  return k;
}

/* ---------------- Sheet reading ---------------- */

type Grid = { values: any[][]; text: string[][] };

async function readSheet(connectionAPIKey: string, fileId: string, sheet: string): Promise<Grid> {
  const base = `/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheet)}`;
  const used = await graph(
    connectionAPIKey,
    `${base}/usedRange(valuesOnly=true)?$select=address,rowCount,columnCount`,
  );
  const address: string = used.address ?? "";
  const rangePart = address.includes("!") ? address.split("!")[1]! : address;
  const [start, end] = rangePart.split(":");
  const sm = /([A-Z]+)(\d+)/.exec(start ?? "A1");
  const em = /([A-Z]+)(\d+)/.exec(end ?? start ?? "A1");
  if (!sm || !em) throw new Error("Kon het bereik van het werkblad niet bepalen.");
  const c1 = colToNum(sm[1]!);
  const r1 = Number(sm[2]);
  const c2 = colToNum(em[1]!);
  const r2 = Number(em[2]);

  const values: any[][] = [];
  const text: string[][] = [];
  const CHUNK = 60;
  for (let r = r1; r <= r2; r += CHUNK) {
    const rEnd = Math.min(r + CHUNK - 1, r2);
    const addr = `${numToCol(c1)}${r}:${numToCol(c2)}${rEnd}`;
    const part = await graph(connectionAPIKey, `${base}/range(address='${addr}')?$select=values,text`);
    for (const row of (part.values ?? []) as any[][]) values.push(row);
    for (const row of (part.text ?? []) as string[][]) text.push(row);
  }
  return { values, text };
}

/* ---------------- Parsing ---------------- */

export type PlanningRow = {
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  dates: string[];
};

const norm = (s: string) => (s ?? "").toString().trim().replace(/\s+/g, " ");
const keyNorm = (s: string) => norm(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function findHeaderRow(text: string[][]): number {
  for (let i = 0; i < Math.min(text.length, 15); i++) {
    const row = text[i] ?? [];
    const hasAddress = row.some((c) => /adres|straat/i.test(c ?? ""));
    if (hasAddress) return i;
  }
  return -1;
}

export function parseGrid(grid: Grid): PlanningRow[] {
  const { values, text } = grid;
  const h = findHeaderRow(text);
  if (h < 0) throw new Error("Geen kolomkop met 'adres' gevonden in het werkblad.");
  const header = text[h] ?? [];
  const headerValues = values[h] ?? [];
  const year = new Date().getFullYear();

  let colAddress = -1, colPostal = -1, colCity = -1, colPhone = -1;
  header.forEach((cell, idx) => {
    const c = (cell ?? "").toLowerCase();
    if (colAddress < 0 && /adres|straat/.test(c)) colAddress = idx;
    else if (colPostal < 0 && /postcode|pc\b/.test(c)) colPostal = idx;
    else if (colCity < 0 && /plaats|woonplaats|stad|gemeente/.test(c)) colCity = idx;
    else if (colPhone < 0 && /tel|gsm|mobiel|nummer klant/.test(c)) colPhone = idx;
  });
  if (colAddress < 0) throw new Error("Geen adreskolom gevonden.");

  const dateCols = new Map<number, string>();
  header.forEach((cell, idx) => {
    if (idx === colAddress || idx === colPostal || idx === colCity || idx === colPhone) return;
    const d = parseDateCell(headerValues[idx], cell ?? "", year);
    if (d) dateCols.set(idx, d);
  });

  const rows: PlanningRow[] = [];
  for (let r = h + 1; r < text.length; r++) {
    const row = text[r] ?? [];
    const address = norm(row[colAddress] ?? "");
    const postal = colPostal >= 0 ? norm(row[colPostal] ?? "") : "";
    if (!address) continue;
    const dates: string[] = [];
    for (const [idx, d] of dateCols) {
      const cell = (row[idx] ?? "").toString().trim().toLowerCase();
      if (cell === "st") dates.push(d);
    }
    if (dates.length === 0) continue;
    rows.push({
      address,
      postal_code: postal,
      city: colCity >= 0 ? norm(row[colCity] ?? "") : "",
      phone: colPhone >= 0 ? norm(row[colPhone] ?? "") : "",
      dates: [...new Set(dates)].sort(),
    });
  }
  return rows;
}

export function externalKey(row: { address: string; postal_code: string }) {
  return `${keyNorm(row.address)}|${keyNorm(row.postal_code)}`;
}

/* ---------------- Sync ---------------- */

export async function syncPlanningForUser(userId: string) {
  const { data: settings } = await (supabaseAdmin.from("company_settings") as any)
    .select("planning_file_id, planning_worksheet")
    .eq("user_id", userId)
    .maybeSingle();
  const fileId = settings?.planning_file_id as string | undefined;
  const sheet = (settings?.planning_worksheet as string | undefined) ?? "";
  if (!fileId) throw new Error("Er is nog geen planningsbestand gekozen.");

  const connectionAPIKey = await requireKey(userId);
  let worksheet = sheet;
  if (!worksheet) {
    const sheets = await listWorksheets(userId, fileId);
    worksheet = sheets[0]?.name ?? "";
    if (!worksheet) throw new Error("Het bestand bevat geen werkbladen.");
  }

  const grid = await readSheet(connectionAPIKey, fileId, worksheet);
  const rows = parseGrid(grid);

  const { data: existingRows, error: exErr } = await (supabaseAdmin.from("planning_sync_rows") as any)
    .select("id, external_key, last_seen_data, project_id")
    .eq("user_id", userId);
  if (exErr) throw exErr;

  const existing = new Map<string, any>();
  for (const r of (existingRows ?? []) as any[]) existing.set(r.external_key, r);

  const nowIso = new Date().toISOString();
  const seen = new Set<string>();
  let created = 0, changed = 0, gone = 0;

  for (const row of rows) {
    const ek = externalKey(row);
    seen.add(ek);
    const prev = existing.get(ek);
    if (!prev) {
      const { data: inserted, error } = await (supabaseAdmin.from("planning_sync_rows") as any)
        .insert({ user_id: userId, external_key: ek, last_seen_data: row, last_synced_at: nowIso })
        .select("id")
        .single();
      if (error) throw error;
      await insertChange(userId, inserted.id, "nieuw", null, row);
      created++;
    } else {
      const old = (prev.last_seen_data ?? {}) as PlanningRow;
      const differs =
        JSON.stringify(old.dates ?? []) !== JSON.stringify(row.dates) ||
        norm(old.phone ?? "") !== row.phone ||
        norm(old.city ?? "") !== row.city ||
        norm(old.address ?? "") !== row.address ||
        norm(old.postal_code ?? "") !== row.postal_code;
      await (supabaseAdmin.from("planning_sync_rows") as any)
        .update({ last_seen_data: row, last_synced_at: nowIso })
        .eq("id", prev.id);
      if (differs) {
        const open = await hasOpenChange(prev.id, "gewijzigd");
        if (!open) {
          await insertChange(userId, prev.id, "gewijzigd", old, row);
          changed++;
        }
      }
    }
  }

  for (const [ek, prev] of existing) {
    if (seen.has(ek)) continue;
    const old = (prev.last_seen_data ?? {}) as PlanningRow;
    if ((old as any).__removed) continue;
    const open = await hasOpenChange(prev.id, "verdwenen");
    if (open) continue;
    await insertChange(userId, prev.id, "verdwenen", old, null);
    await (supabaseAdmin.from("planning_sync_rows") as any)
      .update({ last_seen_data: { ...old, __removed: true }, last_synced_at: nowIso })
      .eq("id", prev.id);
    gone++;
  }

  await (supabaseAdmin.from("company_settings") as any)
    .update({ planning_last_sync_at: nowIso })
    .eq("user_id", userId);

  return { rows: rows.length, nieuw: created, gewijzigd: changed, verdwenen: gone };
}

async function hasOpenChange(syncRowId: string, type: string) {
  const { data } = await (supabaseAdmin.from("planning_changes") as any)
    .select("id")
    .eq("sync_row_id", syncRowId)
    .eq("change_type", type)
    .eq("status", "open")
    .limit(1);
  return ((data ?? []) as any[]).length > 0;
}

async function insertChange(
  userId: string,
  syncRowId: string,
  changeType: "nieuw" | "gewijzigd" | "verdwenen",
  oldData: unknown,
  newData: unknown,
) {
  const { error } = await (supabaseAdmin.from("planning_changes") as any).insert({
    user_id: userId,
    sync_row_id: syncRowId,
    change_type: changeType,
    old_data: oldData,
    new_data: newData,
    status: "open",
  });
  if (error) throw error;
}
