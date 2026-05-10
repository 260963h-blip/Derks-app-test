// Berekent Nederlandse feestdagen voor een gegeven jaar.
// Geeft een Map terug van YYYY-MM-DD => naam van de feestdag.

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Gauss easter algorithm — geeft Date van Eerste Paasdag
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=maart, 4=april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dutchHolidaysForYear(year: number): Map<string, string> {
  const map = new Map<string, string>();
  const easter = easterSunday(year);

  map.set(ymd(new Date(year, 0, 1)), "Nieuwjaarsdag");
  map.set(ymd(addDays(easter, -2)), "Goede Vrijdag");
  map.set(ymd(easter), "Eerste Paasdag");
  map.set(ymd(addDays(easter, 1)), "Tweede Paasdag");

  // Koningsdag: 27 april, of 26 april als 27 april op zondag valt
  const kingsDay = new Date(year, 3, 27);
  if (kingsDay.getDay() === 0) kingsDay.setDate(26);
  map.set(ymd(kingsDay), "Koningsdag");

  // Bevrijdingsdag: 5 mei (officiële vrije dag elke 5 jaar, maar altijd feestdag)
  map.set(ymd(new Date(year, 4, 5)), "Bevrijdingsdag");

  map.set(ymd(addDays(easter, 39)), "Hemelvaartsdag");
  map.set(ymd(addDays(easter, 49)), "Eerste Pinksterdag");
  map.set(ymd(addDays(easter, 50)), "Tweede Pinksterdag");

  map.set(ymd(new Date(year, 11, 25)), "Eerste Kerstdag");
  map.set(ymd(new Date(year, 11, 26)), "Tweede Kerstdag");

  return map;
}

// Bouwt een gecombineerde map voor meerdere jaren
export function dutchHolidaysForYears(years: number[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const y of years) {
    for (const [k, v] of dutchHolidaysForYear(y)) out.set(k, v);
  }
  return out;
}