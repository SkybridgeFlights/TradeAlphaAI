'use strict';

// Phase 104 — global statistical-release schedule (recurring official cadences).
//
// Major non-US releases follow well-known monthly/quarterly cadences published
// by each national statistics office. We generate them at their typical cadence
// and mark them honestly: acquisition_method 'estimated_recurring',
// estimated_date:true, verified_time:false — they are NOT shown as verified, and
// each carries its official statistics-office attribution. Only ALLOWED_TYPES
// (CPI / GDP / Unemployment Rate) are emitted so the normalizer accepts them.

const { monthsInRange, nthWeekdayOfMonth } = require('../schedule-fallback-provider');

// region/country/source per economy.
const ECON = {
  EU: { region: 'Eurozone', source: 'Eurostat', url: 'https://ec.europa.eu/eurostat/web/main/news/euro-indicators' },
  DE: { region: 'Germany', source: 'Destatis (Federal Statistical Office)', url: 'https://www.destatis.de/EN/Home/_node.html' },
  GB: { region: 'United Kingdom', source: 'UK Office for National Statistics', url: 'https://www.ons.gov.uk/releasecalendar' },
  JP: { region: 'Japan', source: 'Statistics Bureau of Japan', url: 'https://www.stat.go.jp/english/' },
  CA: { region: 'Canada', source: 'Statistics Canada', url: 'https://www.statcan.gc.ca/en/dai/btd/sc' },
  AU: { region: 'Australia', source: 'Australian Bureau of Statistics', url: 'https://www.abs.gov.au/release-calendar' },
  CN: { region: 'China', source: 'National Bureau of Statistics of China', url: 'https://www.stats.gov.cn/english/' },
};

// Monthly CPI: [country, nth, weekday(0=Sun..6=Sat), hourUTC]
const MONTHLY_CPI = [
  ['EU', 3, 4, 10], // Eurostat final CPI ~3rd Thursday
  ['DE', 2, 2, 7],  // Destatis ~2nd Tuesday
  ['GB', 3, 3, 7],  // ONS ~3rd Wednesday
  ['JP', 3, 5, 23], // Japan national CPI ~3rd Friday (Fri 08:30 JST ≈ prior 23:30 UTC; approx)
  ['CA', 3, 2, 13], // StatCan ~3rd Tuesday
  ['AU', 4, 3, 1],  // ABS monthly CPI indicator ~4th Wednesday
];
// Monthly Unemployment: [country, nth, weekday, hourUTC, importance]
const MONTHLY_UNEMP = [
  ['EU', 1, 4, 10], // Eurostat unemployment ~1st Thursday
  ['GB', 3, 3, 7],  // ONS labour market ~3rd Wednesday
  ['CA', 1, 5, 13], // StatCan Labour Force ~1st Friday
  ['AU', 3, 4, 1],  // ABS Labour Force ~3rd Thursday
];
// Quarterly GDP: months (0-based) it is released in, nth weekday.
const QUARTERLY_GDP = [
  ['EU', 3, 4], ['GB', 2, 3], ['JP', 2, 1], ['CN', 3, 2],
];
const GDP_RELEASE_MONTHS = [1, 4, 7, 10]; // Feb, May, Aug, Nov (0-based: 1,4,7,10)

function mk(country, name, type, nth, weekday, hourUTC, importance, year, month) {
  const econ = ECON[country];
  const ds = nthWeekdayOfMonth(year, month, weekday, nth);
  if (!ds) return null;
  const dt = new Date(ds + 'T00:00:00Z');
  dt.setUTCHours(hourUTC, 0, 0, 0);
  return {
    event_name: name,
    type,
    category: type === 'CPI' || type === 'Core CPI' ? 'inflation' : type === 'GDP' ? 'growth' : 'labor',
    country,
    region: econ.region,
    importance,
    event_time: dt.toISOString(),
    timezone: 'UTC',
    source_name: econ.source,
    source_url: econ.url,
    acquisition_method: 'estimated_recurring',
    estimated_date: true,
    verified_time: false,
    source_confidence: 50,
    legal_status: 'official_public_cadence',
  };
}

function generate({ from, to } = {}) {
  const fromDate = new Date((from || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  const toDate = new Date((to || from) + 'T00:00:00Z');
  const out = [];
  const months = monthsInRange(fromDate, toDate);

  for (const { year, month } of months) {
    for (const [c, nth, wd, hr] of MONTHLY_CPI) {
      const e = mk(c, ECON[c].region + ' CPI', 'CPI', nth, wd, hr, 'high', year, month);
      if (e) out.push(e);
    }
    for (const [c, nth, wd, hr] of MONTHLY_UNEMP) {
      const e = mk(c, ECON[c].region + ' Unemployment Rate', 'Unemployment Rate', nth, wd, hr, 'medium', year, month);
      if (e) out.push(e);
    }
    if (GDP_RELEASE_MONTHS.includes(month)) {
      for (const [c, nth, wd] of QUARTERLY_GDP) {
        const e = mk(c, ECON[c].region + ' GDP', 'GDP', nth, wd, 9, 'high', year, month);
        if (e) out.push(e);
      }
    }
  }

  // Range filter (nthWeekday can land just outside).
  return out.filter((e) => {
    const d = e.event_time.slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  });
}

module.exports = { generate, ECON };
