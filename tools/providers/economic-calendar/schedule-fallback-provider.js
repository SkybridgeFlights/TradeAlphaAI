'use strict';

// Deterministic high-impact macro schedule generator.
// Produces estimated events when all live API providers are unavailable.
// ALL events: confirmed=false, actual/forecast/previous=null
// Provider name: 'schedule_fallback'
//
// Event types generated:
//   - Initial Jobless Claims (every Thursday, 8:30 AM ET = 12:30 UTC)
//   - Nonfarm Payrolls + Unemployment Rate (first Friday of month, 8:30 AM ET)
//   - FOMC Rate Decision (from embedded near-certain schedule)

const { normalizeProviderEvent } = require('./calendar-normalizer');

// FOMC decision dates embedded for reliability.
// 2025 dates: confirmed from Federal Reserve publications.
// 2026+ dates: estimated from typical 8-meeting annual schedule — confirmed=false.
const FOMC_SCHEDULE = [
  { date: '2025-07-30', confirmed: true },
  { date: '2025-09-17', confirmed: true },
  { date: '2025-10-29', confirmed: true },
  { date: '2025-12-10', confirmed: true },
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

const BLS_NFP_URL     = 'https://www.bls.gov/schedule/news_release/empsit.htm';
const DOL_CLAIMS_URL  = 'https://www.dol.gov/ui/data.pdf';
const FOMC_SOURCE_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';

function fetchCalendar(context) {
  const from      = context.from;
  const to        = context.to;
  const fetchedAt = new Date().toISOString();
  const rawEvents = [];

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate   = new Date(to   + 'T00:00:00Z');

  // ── Initial Jobless Claims: every Thursday ──────────────────────────────────
  const thu = new Date(fromDate);
  const daysToThursday = (4 - thu.getUTCDay() + 7) % 7;
  thu.setUTCDate(thu.getUTCDate() + daysToThursday);
  while (thu <= toDate) {
    rawEvents.push({
      event_name:  'Initial Jobless Claims',
      type:        'Jobless Claims',
      importance:  'high',
      event_time:  thu.toISOString().slice(0, 10) + 'T12:30:00Z',
      source_url:  DOL_CLAIMS_URL,
      source_name: 'U.S. Dept. of Labor',
    });
    thu.setUTCDate(thu.getUTCDate() + 7);
  }

  // ── NFP + Unemployment Rate: first Friday of each month ────────────────────
  for (const fri of firstFridaysInRange(fromDate, toDate)) {
    rawEvents.push({
      event_name:  'Nonfarm Payrolls',
      type:        'NFP',
      importance:  'high',
      event_time:  fri + 'T12:30:00Z',
      source_url:  BLS_NFP_URL,
      source_name: 'U.S. Bureau of Labor Statistics',
    });
    rawEvents.push({
      event_name:  'Unemployment Rate',
      type:        'Unemployment Rate',
      importance:  'high',
      event_time:  fri + 'T12:30:00Z',
      source_url:  BLS_NFP_URL,
      source_name: 'U.S. Bureau of Labor Statistics',
    });
  }

  // ── FOMC Rate Decision: embedded schedule ───────────────────────────────────
  for (const entry of FOMC_SCHEDULE) {
    if (entry.date >= from && entry.date <= to) {
      rawEvents.push({
        event_name:  'FOMC Rate Decision',
        type:        'FOMC Rate Decision',
        importance:  'high',
        event_time:  entry.date + 'T18:00:00Z',
        source_url:  FOMC_SOURCE_URL,
        source_name: 'Federal Reserve',
        _confirmed:  entry.confirmed,
      });
    }
  }

  // Normalize to the standard calendar event schema
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

    return Object.assign({}, normalized, {
      confirmed: raw._confirmed === true,
    });
  }).filter(Boolean);

  console.log(`[SCHEDULE_FALLBACK] generated ${events.length} schedule estimate events for ${from}..${to}`);

  return Promise.resolve({
    provider:  'schedule_fallback',
    endpoint:  'schedule_fallback',
    fetchedAt,
    rawCount:  rawEvents.length,
    events,
  });
}

// Returns YYYY-MM-DD strings for the first Friday of each month in [fromDate, toDate]
function firstFridaysInRange(fromDate, toDate) {
  const result = [];
  // Start at the 1st of fromDate's month
  const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
  while (cursor <= toDate) {
    const firstFri = new Date(cursor);
    // Advance to first Friday of this month
    while (firstFri.getUTCDay() !== 5) firstFri.setUTCDate(firstFri.getUTCDate() + 1);
    if (firstFri >= fromDate && firstFri <= toDate) {
      result.push(firstFri.toISOString().slice(0, 10));
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

module.exports = { fetchCalendar, firstFridaysInRange, FOMC_SCHEDULE };
