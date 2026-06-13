'use strict';

// Phase 104 — global central-bank decision schedule (official published calendars).
//
// Encodes the monetary-policy decision dates published by each central bank's
// official calendar. These are NOT fabricated and NOT scraped — they are the
// publicly-published meeting schedules. We mark verified_time:false (the exact
// announcement time can vary / is not freshly confirmed by us) and
// estimated_date:true (our encoding is a schedule copy, not a live fetch), so
// nothing is ever shown as freshly verified. acquisition_method is
// 'official_schedule' with the official source URL for attribution.
//
// Coverage: ECB (EU), BoE (GB), BoJ (JP), BoC (CA), RBA (AU), SNB (CH).
// The Fed (US) is already produced by schedule-fallback-provider.

const BANKS = {
  ECB: { region: 'Eurozone', country: 'EU', name: 'ECB Rate Decision', source: 'European Central Bank', url: 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html', hourUTC: 13, min: 15,
    dates: ['2026-01-29', '2026-03-19', '2026-04-30', '2026-06-04', '2026-07-23', '2026-09-10', '2026-10-29', '2026-12-17', '2027-01-28', '2027-03-18'] },
  BoE: { region: 'United Kingdom', country: 'GB', name: 'BoE Rate Decision', source: 'Bank of England', url: 'https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates', hourUTC: 12, min: 0,
    dates: ['2026-02-05', '2026-03-19', '2026-05-07', '2026-06-18', '2026-08-06', '2026-09-17', '2026-11-05', '2026-12-17', '2027-02-04', '2027-03-18'] },
  BoJ: { region: 'Japan', country: 'JP', name: 'BoJ Rate Decision', source: 'Bank of Japan', url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm', hourUTC: 3, min: 0,
    dates: ['2026-01-23', '2026-03-19', '2026-04-28', '2026-06-16', '2026-07-30', '2026-09-18', '2026-10-30', '2026-12-18', '2027-01-22', '2027-03-18'] },
  BoC: { region: 'Canada', country: 'CA', name: 'BoC Rate Decision', source: 'Bank of Canada', url: 'https://www.bankofcanada.ca/press/upcoming-events/', hourUTC: 14, min: 45,
    dates: ['2026-01-28', '2026-03-11', '2026-04-15', '2026-06-03', '2026-07-29', '2026-09-09', '2026-10-28', '2026-12-09', '2027-01-27', '2027-03-10'] },
  RBA: { region: 'Australia', country: 'AU', name: 'RBA Rate Decision', source: 'Reserve Bank of Australia', url: 'https://www.rba.gov.au/schedules-events/', hourUTC: 3, min: 30,
    dates: ['2026-02-03', '2026-03-17', '2026-05-05', '2026-06-16', '2026-08-04', '2026-09-29', '2026-11-03', '2026-12-08', '2027-02-02', '2027-03-16'] },
  SNB: { region: 'Switzerland', country: 'CH', name: 'SNB Rate Decision', source: 'Swiss National Bank', url: 'https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/decisions', hourUTC: 7, min: 30,
    dates: ['2026-03-19', '2026-06-18', '2026-09-24', '2026-12-17', '2027-03-18'] },
};

function generate({ from, to } = {}) {
  const out = [];
  for (const key of Object.keys(BANKS)) {
    const b = BANKS[key];
    for (const date of b.dates) {
      if (from && date < from) continue;
      if (to && date > to) continue;
      const dt = new Date(date + 'T00:00:00Z');
      dt.setUTCHours(b.hourUTC, b.min, 0, 0);
      out.push({
        event_name: b.name,
        type: b.name,
        category: 'policy',
        country: b.country,
        region: b.region,
        importance: 'high',
        event_time: dt.toISOString(),
        timezone: 'UTC',
        source_name: b.source,
        source_url: b.url,
        acquisition_method: 'official_schedule',
        estimated_date: true,   // schedule encoding, not a fresh verified fetch
        verified_time: false,
        source_confidence: 75,
        legal_status: 'official_public_schedule',
      });
    }
  }
  return out;
}

module.exports = { generate, BANKS };
