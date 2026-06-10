'use strict';

// Deterministic high-impact US macro schedule generator.
// Produces estimated events when all live API providers are unavailable.
// ALL events: confirmed=false, actual/forecast/previous=null
// Provider name: 'schedule_fallback'
//
// Events generated and their schedule rules:
//   Initial Jobless Claims   — every Thursday at 8:30 AM ET
//   Nonfarm Payrolls         — first Friday of month at 8:30 AM ET
//   Unemployment Rate        — first Friday of month at 8:30 AM ET (with NFP)
//   CPI                      — 2nd Wednesday of month at 8:30 AM ET (BLS estimate)
//   Core CPI                 — same release day/time as CPI
//   Retail Sales             — 3rd Wednesday of month at 8:30 AM ET (Census estimate)
//   ISM Manufacturing PMI    — 1st business day of month at 10:00 AM ET
//   ISM Services PMI         — 3rd business day of month at 10:00 AM ET
//   PCE                      — last Friday of month at 8:30 AM ET (BEA estimate)
//   Core PCE                 — same release day/time as PCE
//   GDP (Advance)            — quarterly, from embedded approximate BEA schedule
//   FOMC Rate Decision       — from embedded Federal Reserve schedule
//
// All dates/times are estimates unless _confirmed=true on an entry.
// Official release calendars:
//   BLS  https://www.bls.gov/bls/news-release/archives.htm
//   BEA  https://www.bea.gov/news/schedule
//   Fed  https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
//   ISM  https://www.ismworld.org/supply-management-news-and-reports/reports/

const { normalizeProviderEvent } = require('./calendar-normalizer');

// ── Source URLs ───────────────────────────────────────────────────────────────

const BLS_NFP_URL     = 'https://www.bls.gov/schedule/news_release/empsit.htm';
const BLS_CPI_URL     = 'https://www.bls.gov/schedule/news_release/cpi.htm';
const DOL_CLAIMS_URL  = 'https://www.dol.gov/ui/data.pdf';
const BEA_PCE_URL     = 'https://www.bea.gov/data/personal-consumption-expenditures-price-index';
const BEA_GDP_URL     = 'https://www.bea.gov/data/gdp/gross-domestic-product';
const CENSUS_RS_URL   = 'https://www.census.gov/retail/index.html';
const ISM_MFG_URL     = 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/pmi/';
const ISM_SVC_URL     = 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/services/';
const FOMC_SOURCE_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';

// ── Embedded schedules ────────────────────────────────────────────────────────

// FOMC decision dates.
// 2025 dates: confirmed from Federal Reserve publications.
// 2026+ dates: estimated from the typical 8-meeting annual schedule.
const FOMC_SCHEDULE = [
  { date: '2025-07-30', confirmed: true  },
  { date: '2025-09-17', confirmed: true  },
  { date: '2025-10-29', confirmed: true  },
  { date: '2025-12-10', confirmed: true  },
  { date: '2026-01-28', confirmed: false },
  { date: '2026-03-18', confirmed: false },
  { date: '2026-05-06', confirmed: false },
  { date: '2026-06-17', confirmed: false },
  { date: '2026-07-29', confirmed: false },
  { date: '2026-09-16', confirmed: false },
  { date: '2026-10-28', confirmed: false },
  { date: '2026-12-09', confirmed: false },
  { date: '2027-01-27', confirmed: false },
  { date: '2027-03-17', confirmed: false },
  { date: '2027-05-05', confirmed: false },
  { date: '2027-06-16', confirmed: false },
  { date: '2027-07-28', confirmed: false },
  { date: '2027-09-15', confirmed: false },
];

// GDP advance release dates — approximately 4 weeks after quarter end.
// BEA typically releases on the last Wednesday of Jan/Apr/Jul/Oct.
// Source: https://www.bea.gov/news/schedule
const GDP_ADVANCE_SCHEDULE = [
  { date: '2025-07-30', confirmed: false }, // Q2 2025 advance
  { date: '2025-10-30', confirmed: false }, // Q3 2025 advance
  { date: '2026-01-29', confirmed: false }, // Q4 2025 advance
  { date: '2026-04-29', confirmed: false }, // Q1 2026 advance
  { date: '2026-07-29', confirmed: false }, // Q2 2026 advance
  { date: '2026-10-29', confirmed: false }, // Q3 2026 advance
  { date: '2027-01-28', confirmed: false }, // Q4 2026 advance
  { date: '2027-04-28', confirmed: false }, // Q1 2027 advance
  { date: '2027-07-30', confirmed: false }, // Q2 2027 advance
  { date: '2027-10-28', confirmed: false }, // Q3 2027 advance
];

// ── Calendar math helpers ─────────────────────────────────────────────────────

// Returns YYYY-MM-DD for the nth (1-based) occurrence of weekday (0=Sun…6=Sat) in month.
// Returns null if the nth occurrence spills into the next month.
function nthWeekdayOfMonth(year, month, weekday, n) {
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d.getUTCMonth() === month ? d.toISOString().slice(0, 10) : null;
}

// Returns YYYY-MM-DD for the last occurrence of weekday in month.
function lastWeekdayOfMonth(year, month, weekday) {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Returns YYYY-MM-DD for the nth business day (Mon-Fri) in month.
// Returns null if the month has fewer than n business days (shouldn't happen).
function nthBusinessDayOfMonth(year, month, n) {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (d.getUTCMonth() === month) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count === n) return d.toISOString().slice(0, 10);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

// Returns true if dateStr (YYYY-MM-DD) falls within US Eastern Daylight Time.
// EDT: second Sunday in March → first Sunday in November (US rules).
function isDSTActive(dateStr) {
  const d    = new Date(dateStr + 'T12:00:00Z');
  const year = d.getUTCFullYear();
  // Second Sunday of March
  const mar = new Date(Date.UTC(year, 2, 1));
  while (mar.getUTCDay() !== 0) mar.setUTCDate(mar.getUTCDate() + 1);
  mar.setUTCDate(mar.getUTCDate() + 7);
  // First Sunday of November
  const nov = new Date(Date.UTC(year, 10, 1));
  while (nov.getUTCDay() !== 0) nov.setUTCDate(nov.getUTCDate() + 1);
  return d >= mar && d < nov;
}

// Converts a YYYY-MM-DD + Eastern Time (hour/minute) to a UTC ISO string.
// Applies EDT (UTC-4) or EST (UTC-5) based on the date.
function toUTC(dateStr, hourET, minuteET) {
  const offset = isDSTActive(dateStr) ? 4 : 5; // EDT = UTC-4, EST = UTC-5
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCHours(hourET + offset, minuteET, 0, 0);
  return d.toISOString();
}

// Returns YYYY-MM-DD strings for the first Friday of each month in [fromDate, toDate].
function firstFridaysInRange(fromDate, toDate) {
  const result = [];
  const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
  while (cursor <= toDate) {
    const fri = new Date(cursor);
    while (fri.getUTCDay() !== 5) fri.setUTCDate(fri.getUTCDate() + 1);
    if (fri >= fromDate && fri <= toDate) result.push(fri.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

// Returns { year, month } for every month overlapping [fromDate, toDate].
function monthsInRange(fromDate, toDate) {
  const months = [];
  const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
  const ey = toDate.getUTCFullYear();
  const em = toDate.getUTCMonth();
  while (cur.getUTCFullYear() < ey || (cur.getUTCFullYear() === ey && cur.getUTCMonth() <= em)) {
    months.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

// ── Main entry point ──────────────────────────────────────────────────────────

function fetchCalendar(context) {
  const from      = context.from;
  const to        = context.to;
  const fetchedAt = new Date().toISOString();
  const rawEvents = [];

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate   = new Date(to   + 'T00:00:00Z');

  // ── Initial Jobless Claims: every Thursday, 8:30 AM ET ─────────────────────
  const thu = new Date(fromDate);
  thu.setUTCDate(thu.getUTCDate() + ((4 - thu.getUTCDay() + 7) % 7));
  while (thu <= toDate) {
    const ds = thu.toISOString().slice(0, 10);
    rawEvents.push({ event_name: 'Initial Jobless Claims', type: 'Jobless Claims',
      importance: 'high', event_time: toUTC(ds, 8, 30),
      source_url: DOL_CLAIMS_URL, source_name: 'U.S. Dept. of Labor', _confirmed: false });
    thu.setUTCDate(thu.getUTCDate() + 7);
  }

  // ── NFP + Unemployment Rate: first Friday of each month, 8:30 AM ET ────────
  for (const fri of firstFridaysInRange(fromDate, toDate)) {
    rawEvents.push({ event_name: 'Nonfarm Payrolls', type: 'NFP',
      importance: 'high', event_time: toUTC(fri, 8, 30),
      source_url: BLS_NFP_URL, source_name: 'U.S. Bureau of Labor Statistics', _confirmed: false });
    rawEvents.push({ event_name: 'Unemployment Rate', type: 'Unemployment Rate',
      importance: 'high', event_time: toUTC(fri, 8, 30),
      source_url: BLS_NFP_URL, source_name: 'U.S. Bureau of Labor Statistics', _confirmed: false });
  }

  // ── CPI + Core CPI: 2nd Wednesday of each month, 8:30 AM ET ───────────────
  for (const { year, month } of monthsInRange(fromDate, toDate)) {
    const ds = nthWeekdayOfMonth(year, month, 3, 2); // 3=Wed, n=2
    if (ds && ds >= from && ds <= to) {
      rawEvents.push({ event_name: 'CPI', type: 'CPI',
        importance: 'high', event_time: toUTC(ds, 8, 30),
        source_url: BLS_CPI_URL, source_name: 'U.S. Bureau of Labor Statistics', _confirmed: false });
      rawEvents.push({ event_name: 'Core CPI', type: 'Core CPI',
        importance: 'high', event_time: toUTC(ds, 8, 30),
        source_url: BLS_CPI_URL, source_name: 'U.S. Bureau of Labor Statistics', _confirmed: false });
    }
  }

  // ── Retail Sales: 3rd Wednesday of each month, 8:30 AM ET ─────────────────
  for (const { year, month } of monthsInRange(fromDate, toDate)) {
    const ds = nthWeekdayOfMonth(year, month, 3, 3); // 3=Wed, n=3
    if (ds && ds >= from && ds <= to) {
      rawEvents.push({ event_name: 'Retail Sales', type: 'Retail Sales',
        importance: 'high', event_time: toUTC(ds, 8, 30),
        source_url: CENSUS_RS_URL, source_name: 'U.S. Census Bureau', _confirmed: false });
    }
  }

  // ── ISM Manufacturing PMI: 1st business day of each month, 10:00 AM ET ────
  for (const { year, month } of monthsInRange(fromDate, toDate)) {
    const ds = nthBusinessDayOfMonth(year, month, 1);
    if (ds && ds >= from && ds <= to) {
      rawEvents.push({ event_name: 'ISM Manufacturing PMI', type: 'ISM PMI',
        importance: 'medium', event_time: toUTC(ds, 10, 0),
        source_url: ISM_MFG_URL, source_name: 'Institute for Supply Management', _confirmed: false });
    }
  }

  // ── ISM Services PMI: 3rd business day of each month, 10:00 AM ET ─────────
  for (const { year, month } of monthsInRange(fromDate, toDate)) {
    const ds = nthBusinessDayOfMonth(year, month, 3);
    if (ds && ds >= from && ds <= to) {
      rawEvents.push({ event_name: 'ISM Services PMI', type: 'ISM PMI',
        importance: 'medium', event_time: toUTC(ds, 10, 0),
        source_url: ISM_SVC_URL, source_name: 'Institute for Supply Management', _confirmed: false });
    }
  }

  // ── PCE + Core PCE: last Friday of each month, 8:30 AM ET ─────────────────
  for (const { year, month } of monthsInRange(fromDate, toDate)) {
    const ds = lastWeekdayOfMonth(year, month, 5); // 5=Fri
    if (ds >= from && ds <= to) {
      rawEvents.push({ event_name: 'PCE', type: 'PCE',
        importance: 'high', event_time: toUTC(ds, 8, 30),
        source_url: BEA_PCE_URL, source_name: 'Bureau of Economic Analysis', _confirmed: false });
      rawEvents.push({ event_name: 'Core PCE', type: 'Core PCE',
        importance: 'high', event_time: toUTC(ds, 8, 30),
        source_url: BEA_PCE_URL, source_name: 'Bureau of Economic Analysis', _confirmed: false });
    }
  }

  // ── GDP Advance: quarterly, from embedded BEA schedule, 8:30 AM ET ─────────
  for (const entry of GDP_ADVANCE_SCHEDULE) {
    if (entry.date >= from && entry.date <= to) {
      rawEvents.push({ event_name: 'GDP', type: 'GDP',
        importance: 'high', event_time: toUTC(entry.date, 8, 30),
        source_url: BEA_GDP_URL, source_name: 'Bureau of Economic Analysis', _confirmed: entry.confirmed });
    }
  }

  // ── FOMC Rate Decision: from embedded Fed schedule, 2:00 PM ET ─────────────
  for (const entry of FOMC_SCHEDULE) {
    if (entry.date >= from && entry.date <= to) {
      rawEvents.push({ event_name: 'FOMC Rate Decision', type: 'FOMC Rate Decision',
        importance: 'high', event_time: toUTC(entry.date, 14, 0),
        source_url: FOMC_SOURCE_URL, source_name: 'Federal Reserve', _confirmed: entry.confirmed });
    }
  }

  // ── Normalize ─────────────────────────────────────────────────────────────
  const events = rawEvents.map(function (raw) {
    const providerMeta = {
      name:         'schedule_fallback',
      sourceName:   raw.source_name,
      sourceUrl:    raw.source_url,
      fetchedAt,
      capabilities: { forecasts: false, actuals: false, precise_time: true, schedule_estimate: true },
    };
    const normalized = normalizeProviderEvent({
      event_name:     raw.event_name,
      type:           raw.type,
      importance:     raw.importance,
      event_time:     raw.event_time,
      country:        'US',
      source_url:     raw.source_url,
      time_precision: 'time_estimate',
      status:         'scheduled',
      tags:           ['schedule-estimate'],
    }, providerMeta);

    if (normalized.error) {
      console.log(`[SCHEDULE_FALLBACK] skipped ${raw.event_name} on ${raw.event_time}: ${normalized.error}`);
      return null;
    }
    return Object.assign({}, normalized, { confirmed: raw._confirmed === true });
  }).filter(Boolean);

  console.log(`[SCHEDULE_FALLBACK] generated ${events.length} schedule estimate events for ${from}..${to}`);

  return Promise.resolve({
    provider: 'schedule_fallback',
    endpoint: 'schedule_fallback',
    fetchedAt,
    rawCount: rawEvents.length,
    events,
  });
}

module.exports = {
  fetchCalendar,
  firstFridaysInRange,
  monthsInRange,
  nthWeekdayOfMonth,
  lastWeekdayOfMonth,
  nthBusinessDayOfMonth,
  isDSTActive,
  toUTC,
  FOMC_SCHEDULE,
  GDP_ADVANCE_SCHEDULE,
};
